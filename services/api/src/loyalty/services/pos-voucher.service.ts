import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoyaltyTxType, Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { isTruthy } from '../../common/utils/config';
import { normalizePhoneToE164 } from '../../common/utils/phone-normalize';
import { EncryptionService } from '../../integrations/encryption.service';
import type { POSAdapter } from '../../pos/interfaces/pos-adapter.interface';
import { POSAdapterFactory } from '../../pos/pos-adapter.factory';
import { LoyaltyBurnEngine } from '../engines/burn.engine';
import { LoyaltyWalletService } from './wallet.service';
import { RedeemForVoucherDto } from '../dto/redeem-for-voucher.dto';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { isLoyaltyRuntimeEnabled } from '../loyalty-enabled';

const CARD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CARD_LENGTH = 12;

@Injectable()
export class PosVoucherService {
  private readonly logger = new Logger(PosVoucherService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
    private burn: LoyaltyBurnEngine,
    private wallet: LoyaltyWalletService,
    private factory: POSAdapterFactory,
    private encryption: EncryptionService,
  ) {}

  assertVoucherEnabled(): void {
    if (!isLoyaltyRuntimeEnabled(this.config, this.featureFlags)) {
      throw new BadRequestException('Loyalty programme is not enabled');
    }
    if (!isTruthy(this.config.get<string>('LOYALTY_POS_VOUCHER_ENABLED'))) {
      throw new BadRequestException('POS loyalty voucher redemption is not enabled');
    }
  }

  /** Secure non-sequential alphanumeric gift card number (12+ chars). */
  generateCardNumber(length = CARD_LENGTH): string {
    const n = Math.max(8, length);
    const bytes = randomBytes(n);
    let out = '';
    for (let i = 0; i < n; i++) {
      out += CARD_ALPHABET[bytes[i] % CARD_ALPHABET.length];
    }
    return out;
  }

  async redeemForVoucher(dto: RedeemForVoucherDto): Promise<{
    voucherId: string;
    redemptionId: string;
    cardNumber: string;
    amount: number;
    currency: string;
    status: string;
    points: number;
  }> {
    this.assertVoucherEnabled();

    if (dto.voucherId) {
      return this.retryFailedVoucher(dto.voucherId);
    }

    const idempotencyKey = dto.idempotencyKey?.trim();
    if (!idempotencyKey || idempotencyKey.length < 8) {
      throw new BadRequestException(
        'idempotencyKey of at least 8 characters is required (e.g. terminal id + till sale reference) so a repeated request cannot burn points twice',
      );
    }

    const membershipId = await this.resolveMembershipId(dto);
    const store = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
      include: { posConnection: true },
    });
    if (!store?.isActive) {
      throw new BadRequestException('Store not found or inactive');
    }
    if (!store.posConnection?.isActive || !store.posConnection.credentials) {
      throw new BadRequestException('Store has no active POS connection');
    }

    const redeemValue = this.resolveRedeemValue(store.loyaltyRedeemValue);
    const amount = this.roundMoney(dto.points * redeemValue);
    if (amount <= 0) {
      throw new BadRequestException('Redemption amount must be greater than zero');
    }

    // Check for an existing voucher via the burn engine's wallet key before validating
    // limits, so idempotent replays always succeed regardless of config changes.
    const walletKey = `burn:key:${membershipId}:${idempotencyKey}`;
    const priorWalletTx = await this.prisma.loyaltyTransaction.findUnique({
      where: { idempotencyKey: walletKey },
      select: { sourceId: true },
    });
    if (priorWalletTx?.sourceId) {
      const priorVoucher = await this.prisma.loyaltyPosVoucher.findUnique({
        where: { redemptionId: priorWalletTx.sourceId },
        select: { id: true },
      });
      if (priorVoucher) {
        return this.retryFailedVoucher(priorVoucher.id);
      }
    }

    this.assertGiftCardAmountLimits(amount, store.currency || 'GBP');

    const { redemptionId } = await this.burn.processRedemption({
      membershipId,
      points: dto.points,
      channel: 'HOS_OUTLET_POS',
      storeId: dto.storeId,
      idempotencyKey,
    });

    // Burn engine replay: redemptionId matches an existing voucher from a prior attempt
    // where the voucher record was created but the gift card issuance may have failed.
    const existingVoucher = await this.prisma.loyaltyPosVoucher.findUnique({
      where: { redemptionId },
      select: { id: true },
    });
    if (existingVoucher) {
      return this.retryFailedVoucher(existingVoucher.id);
    }

    const cardNumber = this.generateCardNumber();
    const currency = store.currency || 'GBP';

    let voucher;
    try {
      voucher = await this.prisma.loyaltyPosVoucher.create({
        data: {
          membershipId,
          redemptionId,
          storeId: dto.storeId,
          cardNumber,
          amount: new Decimal(amount.toFixed(2)),
          currency,
          clientId: redemptionId,
          status: 'PENDING',
        },
      });
    } catch (e) {
      await this.reverseBurn(membershipId, dto.points, redemptionId, dto.storeId);
      throw e;
    }

    return this.issueGiftCardForVoucher(voucher.id, store.posConnection);
  }

  /**
   * Retry a FAILED voucher: same clientId + cardNumber; re-debit points if burn was reversed.
   */
  async retryFailedVoucher(voucherId: string): Promise<{
    voucherId: string;
    redemptionId: string;
    cardNumber: string;
    amount: number;
    currency: string;
    status: string;
    points: number;
  }> {
    this.assertVoucherEnabled();

    const voucher = await this.prisma.loyaltyPosVoucher.findUnique({
      where: { id: voucherId },
      include: {
        redemption: true,
        store: { include: { posConnection: true } },
      },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (voucher.status === 'ISSUED') {
      return this.toResult(voucher, voucher.redemption.pointsSpent);
    }
    if (voucher.status !== 'FAILED' && voucher.status !== 'PENDING') {
      throw new BadRequestException(`Cannot retry voucher in status ${voucher.status}`);
    }
    if (!voucher.store.posConnection?.isActive) {
      throw new BadRequestException('Store has no active POS connection');
    }

    const points = voucher.redemption.pointsSpent;

    if (voucher.redemption.status === 'REVERSED') {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.applyDelta(tx, voucher.membershipId, -points, LoyaltyTxType.BURN, {
          source: 'POS_VOUCHER_RETRY',
          sourceId: voucher.redemptionId,
          channel: 'HOS_OUTLET_POS',
          storeId: voucher.storeId,
          description: 'Retry POS voucher issuance',
          metadata: { voucherId: voucher.id, clientId: voucher.clientId },
        });
        await tx.loyaltyMembership.update({
          where: { id: voucher.membershipId },
          data: { totalPointsRedeemed: { increment: points } },
        });
        await tx.loyaltyRedemption.update({
          where: { id: voucher.redemptionId },
          data: { status: 'COMPLETED' },
        });
        await tx.loyaltyPosVoucher.update({
          where: { id: voucher.id },
          data: { status: 'PENDING' },
        });
      });
    } else if (voucher.status === 'FAILED') {
      await this.prisma.loyaltyPosVoucher.update({
        where: { id: voucher.id },
        data: { status: 'PENDING' },
      });
    }

    return this.issueGiftCardForVoucher(voucher.id, voucher.store.posConnection);
  }

  private async issueGiftCardForVoucher(
    voucherId: string,
    connection: { provider: string; credentials: string },
  ): Promise<{
    voucherId: string;
    redemptionId: string;
    cardNumber: string;
    amount: number;
    currency: string;
    status: string;
    points: number;
  }> {
    const voucher = await this.prisma.loyaltyPosVoucher.findUnique({
      where: { id: voucherId },
      include: { redemption: true },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');

    const amount = Number(voucher.amount);
    const adapter = await this.buildAdapter(connection);

    try {
      const { externalTransactionId, expiresAt } = await this.createOrReloadGiftCard(
        adapter,
        voucher.cardNumber,
        amount,
        voucher.clientId,
      );

      const updated = await this.prisma.loyaltyPosVoucher.update({
        where: { id: voucher.id },
        data: {
          status: 'ISSUED',
          externalTransactionId,
          issuedAt: new Date(),
          expiresAt: expiresAt ?? undefined,
        },
        include: { redemption: true },
      });

      return this.toResult(updated, updated.redemption.pointsSpent);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gift card issuance failed';
      this.logger.warn(
        `POS voucher ${voucher.id} gift card issue failed (clientId=${voucher.clientId}): ${msg}`,
      );

      await this.prisma.loyaltyPosVoucher.update({
        where: { id: voucher.id },
        data: {
          status: 'FAILED',
          metadata: { lastError: msg.slice(0, 500) } as Prisma.InputJsonValue,
        },
      });

      try {
        await this.reverseBurn(
          voucher.membershipId,
          voucher.redemption.pointsSpent,
          voucher.redemptionId,
          voucher.storeId,
        );
      } catch (revErr) {
        this.logger.error(
          `Failed to reverse burn for voucher ${voucher.id}: ${
            revErr instanceof Error ? revErr.message : 'unknown'
          }`,
        );
      }

      throw new ServiceUnavailableException(
        `Failed to issue POS gift card: ${msg}. Points have been restored where possible; retry with voucherId=${voucher.id}`,
      );
    }
  }

  /**
   * Create a new card, or reload if the number already exists (retry / partial success).
   * Always uses the same clientId for RELOADING idempotency.
   */
  private async createOrReloadGiftCard(
    adapter: POSAdapter,
    cardNumber: string,
    amount: number,
    clientId: string,
  ): Promise<{ externalTransactionId: string; expiresAt?: Date | null }> {
    const existing = await adapter.getGiftCardByNumber(cardNumber);

    if (existing) {
      const prior = existing.transactions?.find((t) => t.clientId === clientId);
      if (prior?.id) {
        return {
          externalTransactionId: prior.id,
          expiresAt: existing.expiresAt ? new Date(existing.expiresAt) : null,
        };
      }

      // Create may have already funded the card (ACTIVATION) on a prior attempt.
      if (Number(existing.balance) >= amount - 0.001) {
        const activation = existing.transactions?.find((t) => t.type === 'ACTIVATION');
        return {
          externalTransactionId: activation?.id || existing.id,
          expiresAt: existing.expiresAt ? new Date(existing.expiresAt) : null,
        };
      }

      const tx = await adapter.giftCardTransaction(cardNumber, {
        amount,
        type: 'RELOADING',
        clientId,
      });
      return {
        externalTransactionId: tx.id,
        expiresAt: existing.expiresAt ? new Date(existing.expiresAt) : null,
      };
    }

    const created = await adapter.createGiftCard({ number: cardNumber, amount });
    const activation = created.transactions?.find((t) => t.type === 'ACTIVATION');
    return {
      externalTransactionId: activation?.id || created.id,
      expiresAt: created.expiresAt ? new Date(created.expiresAt) : null,
    };
  }

  private async buildAdapter(connection: {
    provider: string;
    credentials: string;
  }): Promise<POSAdapter> {
    const creds = this.encryption.decryptJson<Record<string, unknown>>(connection.credentials);
    const adapter = this.factory.create(connection.provider, connection.credentials);
    await adapter.authenticate(creds);
    return adapter;
  }

  private resolveRedeemValue(storeValue: Decimal | number | null | undefined): number {
    if (storeValue != null) {
      const n = Number(storeValue);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const fallback = Number(this.config.get('LOYALTY_DEFAULT_REDEEM_VALUE', 0.01));
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0.01;
  }

  /**
   * Validate against Lightspeed gift card amount limits.
   * Lightspeed rejects gift cards below and above configurable thresholds.
   */
  private assertGiftCardAmountLimits(amount: number, currency: string): void {
    const min = Number(this.config.get('POS_GIFT_CARD_MIN_AMOUNT', 1));
    const max = Number(this.config.get('POS_GIFT_CARD_MAX_AMOUNT', 500));
    if (Number.isFinite(min) && amount < min) {
      throw new BadRequestException(
        `Gift card amount ${currency} ${amount.toFixed(2)} is below the minimum ${currency} ${min.toFixed(2)}`,
      );
    }
    if (Number.isFinite(max) && amount > max) {
      throw new BadRequestException(
        `Gift card amount ${currency} ${amount.toFixed(2)} exceeds the maximum ${currency} ${max.toFixed(2)}`,
      );
    }
  }

  private roundMoney(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private async reverseBurn(
    membershipId: string,
    points: number,
    redemptionId: string,
    storeId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const redemption = await tx.loyaltyRedemption.findUnique({ where: { id: redemptionId } });
      if (!redemption || redemption.status === 'REVERSED') return;

      await this.wallet.applyDelta(tx, membershipId, points, LoyaltyTxType.ADJUST, {
        source: 'POS_VOUCHER_REVERSAL',
        sourceId: redemptionId,
        channel: 'HOS_OUTLET_POS',
        storeId,
        description: 'Reversed POS voucher issuance failure',
        metadata: { redemptionId },
      });
      await tx.loyaltyMembership.update({
        where: { id: membershipId },
        data: { totalPointsRedeemed: { decrement: points } },
      });
      await tx.loyaltyRedemption.update({
        where: { id: redemptionId },
        data: { status: 'REVERSED' },
      });
    });
  }

  private async resolveMembershipId(dto: RedeemForVoucherDto): Promise<string> {
    if (dto.membershipId) {
      const m = await this.prisma.loyaltyMembership.findUnique({
        where: { id: dto.membershipId },
      });
      if (!m) throw new NotFoundException('Membership not found');
      return m.id;
    }

    const email = dto.email?.trim();
    const phone = dto.phone?.trim();
    const cardNumber = dto.cardNumber?.trim();
    if (!email && !phone && !cardNumber) {
      throw new BadRequestException('Provide membershipId, email, phone, or cardNumber');
    }

    if (cardNumber) {
      const byCard = await this.prisma.loyaltyMembership.findFirst({
        where: { cardNumber: { equals: cardNumber, mode: 'insensitive' } },
      });
      if (byCard) return byCard.id;
    }

    if (email) {
      const byEmail = await this.prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        include: { loyaltyMembership: true },
      });
      if (byEmail?.loyaltyMembership) return byEmail.loyaltyMembership.id;
    }

    if (phone) {
      const phoneNormalized = normalizePhoneToE164(phone);
      const byPhone = await this.prisma.user.findFirst({
        where: phoneNormalized
          ? { OR: [{ phoneNormalized }, { phone }] }
          : { phone },
        include: { loyaltyMembership: true },
      });
      if (byPhone?.loyaltyMembership) return byPhone.loyaltyMembership.id;
    }

    throw new NotFoundException('Member not found');
  }

  private toResult(
    voucher: {
      id: string;
      redemptionId: string;
      cardNumber: string;
      amount: Decimal | number;
      currency: string;
      status: string;
    },
    points: number,
  ) {
    return {
      voucherId: voucher.id,
      redemptionId: voucher.redemptionId,
      cardNumber: voucher.cardNumber,
      amount: Number(voucher.amount),
      currency: voucher.currency,
      status: voucher.status,
      points,
    };
  }
}
