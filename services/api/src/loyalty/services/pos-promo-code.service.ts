import {
  BadRequestException,
  ForbiddenException,
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
import { normalizePhoneToE164 } from '../../common/utils/phone-normalize';
import { EncryptionService } from '../../integrations/encryption.service';
import type { POSAdapter } from '../../pos/interfaces/pos-adapter.interface';
import { POSAdapterFactory } from '../../pos/pos-adapter.factory';
import { LoyaltyBurnEngine } from '../engines/burn.engine';
import { LoyaltyWalletService } from './wallet.service';
import { LoyaltySettingsService } from './loyalty-settings.service';
import { RedeemForVoucherDto } from '../dto/redeem-for-voucher.dto';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { PlatformRegionService } from '../../config/platform-region.service';
import { isLoyaltyRuntimeEnabled } from '../loyalty-enabled';

const VOUCHER_TTL_HOURS = 4;
const ISSUE_BUDGET_MS = 20_000;
const ARCHIVE_BUDGET_MS = 8_000;
const PROMO_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export type PosPromoRedeemContext = {
  staffUserId?: string;
  issuedByUserId?: string;
  terminalId?: string;
};

export type PosPromoCodeResult = {
  voucherId: string;
  redemptionId: string;
  cardNumber: string;
  promoCode: string;
  amount: number;
  currency: string;
  status: string;
  points: number;
  type: 'PROMO_CODE';
  ttlExpiresAt?: Date | null;
  qrPayload?: string;
};

@Injectable()
export class PosPromoCodeService {
  private readonly logger = new Logger(PosPromoCodeService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
    private burn: LoyaltyBurnEngine,
    private wallet: LoyaltyWalletService,
    private factory: POSAdapterFactory,
    private encryption: EncryptionService,
    private loyaltySettings: LoyaltySettingsService,
    private platformRegion: PlatformRegionService,
  ) {}

  async assertPromoCodeEnabled(): Promise<void> {
    if (!isLoyaltyRuntimeEnabled(this.config, this.featureFlags)) {
      throw new BadRequestException('Loyalty programme is not enabled');
    }
    const { settings } = await this.loyaltySettings.getResolved();
    if (!settings.posVoucherEnabled) {
      throw new BadRequestException('POS loyalty voucher redemption is not enabled');
    }
  }

  generatePromoCode(): string {
    const bytes = randomBytes(8);
    let suffix = '';
    for (let i = 0; i < 8; i++) {
      suffix += PROMO_CODE_ALPHABET[bytes[i] % PROMO_CODE_ALPHABET.length];
    }
    return `HOS-LYL-${suffix}`;
  }

  async redeemForPromoCode(
    dto: RedeemForVoucherDto,
    ctx: PosPromoRedeemContext = {},
  ): Promise<PosPromoCodeResult> {
    await this.assertPromoCodeEnabled();

    if (dto.voucherId) {
      return this.retryFailedPromoCode(dto.voucherId, dto.storeId);
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

    const redeemValue = await this.resolveRedeemValue(store.loyaltyRedeemValue);
    const amount = Math.round(dto.points * redeemValue * 100) / 100;
    if (amount <= 0) {
      throw new BadRequestException('Redemption amount must be greater than zero');
    }
    const currency = store.currency || (await this.platformRegion.getCurrency());

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
        return this.retryFailedPromoCode(priorVoucher.id, dto.storeId);
      }
    }

    await this.assertAmountLimits(amount, currency);

    const { redemptionId } = await this.burn.processRedemption({
      membershipId,
      points: dto.points,
      channel: 'HOS_OUTLET_POS',
      storeId: dto.storeId,
      idempotencyKey,
      purchaseSubtotal: dto.purchaseSubtotal,
      skipWelcomeGate: true,
    });

    const existingVoucher = await this.prisma.loyaltyPosVoucher.findUnique({
      where: { redemptionId },
      select: { id: true },
    });
    if (existingVoucher) {
      return this.retryFailedPromoCode(existingVoucher.id, dto.storeId);
    }

    return this.createAndIssuePromo({
      membershipId,
      redemptionId,
      storeId: dto.storeId,
      amount,
      currency,
      posConnection: store.posConnection,
      reverseBurnOnCreateFailure: { points: dto.points },
      audit: {
        staffUserId: ctx.staffUserId,
        issuedByUserId: ctx.issuedByUserId ?? ctx.staffUserId,
        terminalId: dto.terminalId?.trim() || ctx.terminalId,
      },
    });
  }

  async retryFailedPromoCode(voucherId: string, expectedStoreId?: string): Promise<PosPromoCodeResult> {
    await this.assertPromoCodeEnabled();
    const voucher = await this.prisma.loyaltyPosVoucher.findUnique({
      where: { id: voucherId },
      include: {
        redemption: true,
        store: { include: { posConnection: true } },
      },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (expectedStoreId && voucher.storeId !== expectedStoreId) {
      throw new NotFoundException('Voucher not found');
    }
    if (voucher.status === 'ISSUED') {
      return this.toResult(voucher, voucher.redemption.pointsSpent);
    }
    if (voucher.status !== 'FAILED' && voucher.status !== 'PENDING') {
      throw new BadRequestException(`Cannot retry voucher in status ${voucher.status}`);
    }
    if (!voucher.store.posConnection?.isActive) {
      throw new BadRequestException('Store has no active POS connection');
    }
    if (voucher.redemption.status === 'REVERSED') {
      await this.redebit(voucher.membershipId, voucher.redemption.pointsSpent, voucher.redemptionId, voucher.storeId);
      await this.prisma.loyaltyPosVoucher.update({
        where: { id: voucher.id },
        data: { status: 'PENDING' },
      });
    } else if (voucher.status === 'FAILED') {
      await this.prisma.loyaltyPosVoucher.updateMany({
        where: { id: voucher.id, status: 'FAILED' },
        data: { status: 'PENDING' },
      });
    }
    return this.issuePromotionForVoucher(voucher.id, voucher.store.posConnection);
  }

  async cancelPromoCode(params: {
    voucherId: string;
    actorUserId: string;
    actorRole: string;
    reason?: string;
  }): Promise<{ status: string; pointsRestored: boolean }> {
    await this.assertPromoCodeEnabled();
    const voucher = await this.prisma.loyaltyPosVoucher.findUnique({
      where: { id: params.voucherId },
      include: {
        redemption: true,
        store: { include: { posConnection: true } },
        membership: { select: { userId: true } },
      },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (voucher.status !== 'ISSUED') {
      throw new BadRequestException(`Cannot cancel voucher in status ${voucher.status}`);
    }

    const isOwner = voucher.membership.userId === params.actorUserId;
    const isAdmin = params.actorRole === 'ADMIN';
    const isStoreStaff = params.actorRole === 'STORE_STAFF';

    if (isStoreStaff && !isOwner) {
      const staffUser = await this.prisma.user.findUnique({
        where: { id: params.actorUserId },
        select: { storeId: true },
      });
      if (!staffUser?.storeId || staffUser.storeId !== voucher.storeId) {
        throw new ForbiddenException('You can only cancel vouchers from your own store');
      }
    }

    if (!isOwner && !isAdmin && !isStoreStaff) {
      throw new ForbiddenException('You are not allowed to cancel this voucher');
    }
    if (voucher.staffUserId && voucher.staffUserId === params.actorUserId && isStoreStaff) {
      throw new ForbiddenException('Staff who issued a voucher cannot void it — ask a manager');
    }

    const conn = voucher.store.posConnection;
    if (!conn?.isActive || !conn.credentials) {
      throw new BadRequestException('Store has no active POS connection');
    }
    if (voucher.externalPromotionId) {
      const adapter = await this.buildAdapter(conn, ARCHIVE_BUDGET_MS);
      this.assertPromotions(adapter);
      try {
        await adapter.archivePromotion!(voucher.externalPromotionId);
      } catch (e) {
        this.logger.warn(
          `archivePromotion on cancel failed for ${voucher.id}: ${(e as Error).message}`,
        );
        throw new BadRequestException(
          'Could not archive promo code in Lightspeed — voucher not cancelled',
        );
      }
    }

    let pointsRestored = false;
    try {
      await this.reverseBurn(
        voucher.membershipId,
        voucher.redemption.pointsSpent,
        voucher.redemptionId,
        voucher.storeId,
      );
      pointsRestored = true;
    } catch (e) {
      this.logger.error(
        `Points restore failed after promo archive for ${voucher.id}: ${(e as Error).message}`,
      );
    }

    await this.prisma.loyaltyPosVoucher.update({
      where: { id: voucher.id },
      data: {
        status: 'REVERSED',
        reversedAt: new Date(),
        metadata: {
          ...(voucher.metadata as object),
          cancelReason: params.reason?.slice(0, 200) ?? 'user_cancelled',
          cancelledBy: params.actorUserId,
        } as Prisma.InputJsonValue,
      },
    });
    return { status: 'REVERSED', pointsRestored };
  }

  async expireUnusedPromoCodes(): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.loyaltyPosVoucher.findMany({
      where: {
        status: 'ISSUED',
        type: 'PROMO_CODE',
        ttlExpiresAt: { lte: now },
      },
      include: {
        redemption: true,
        store: { include: { posConnection: true } },
      },
      take: 50,
    });

    let count = 0;
    for (const voucher of expired) {
      try {
        const conn = voucher.store.posConnection;
        if (conn?.isActive && conn.credentials && voucher.externalPromotionId) {
          const adapter = await this.buildAdapter(conn, ARCHIVE_BUDGET_MS);
          if (typeof adapter.archivePromotion === 'function') {
            try {
              await adapter.archivePromotion(voucher.externalPromotionId);
            } catch (e) {
              this.logger.warn(
                `TTL archive failed for promo ${voucher.id}: ${(e as Error).message}`,
              );
              continue;
            }
          }
        }
        await this.reverseBurn(
          voucher.membershipId,
          voucher.redemption.pointsSpent,
          voucher.redemptionId,
          voucher.storeId,
        );
        await this.prisma.loyaltyPosVoucher.update({
          where: { id: voucher.id },
          data: {
            status: 'REVERSED',
            reversedAt: now,
            metadata: { autoExpired: true } as Prisma.InputJsonValue,
          },
        });
        count++;
      } catch (e) {
        this.logger.warn(`TTL expire failed for promo ${voucher.id}: ${(e as Error).message}`);
      }
    }
    return count;
  }

  private async createAndIssuePromo(params: {
    membershipId: string;
    redemptionId: string;
    storeId: string;
    amount: number;
    currency: string;
    posConnection: { provider: string; credentials: string; settings?: unknown; externalOutletId?: string | null };
    reverseBurnOnCreateFailure?: { points: number };
    audit?: { staffUserId?: string; issuedByUserId?: string; terminalId?: string };
  }): Promise<PosPromoCodeResult> {
    const promoCode = this.generatePromoCode();
    const ttlExpiresAt = new Date(Date.now() + VOUCHER_TTL_HOURS * 60 * 60 * 1000);
    let voucher;
    try {
      voucher = await this.prisma.loyaltyPosVoucher.create({
        data: {
          membershipId: params.membershipId,
          redemptionId: params.redemptionId,
          storeId: params.storeId,
          type: 'PROMO_CODE',
          cardNumber: promoCode,
          promoCode,
          amount: new Decimal(params.amount.toFixed(2)),
          currency: params.currency,
          clientId: params.redemptionId,
          status: 'PENDING',
          ttlExpiresAt,
          staffUserId: params.audit?.staffUserId,
          issuedByUserId: params.audit?.issuedByUserId,
          terminalId: params.audit?.terminalId,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.loyaltyPosVoucher.findUnique({
          where: { redemptionId: params.redemptionId },
          select: { id: true },
        });
        if (existing) return this.retryFailedPromoCode(existing.id, params.storeId);
      }
      if (params.reverseBurnOnCreateFailure) {
        await this.reverseBurn(
          params.membershipId,
          params.reverseBurnOnCreateFailure.points,
          params.redemptionId,
          params.storeId,
        );
      }
      throw e;
    }
    return this.issuePromotionForVoucher(voucher.id, params.posConnection);
  }

  private async issuePromotionForVoucher(
    voucherId: string,
    connection: { provider: string; credentials: string; settings?: unknown; externalOutletId?: string },
  ): Promise<PosPromoCodeResult> {
    const voucher = await this.prisma.loyaltyPosVoucher.findUnique({
      where: { id: voucherId },
      include: { redemption: true, store: { include: { posConnection: true } } },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    if (voucher.status === 'ISSUED') {
      return this.toResult(voucher, voucher.redemption.pointsSpent);
    }

    if (voucher.externalPromotionId) {
      try {
        const adapter = await this.buildAdapter(connection, ISSUE_BUDGET_MS);
        this.assertPromotions(adapter);
        const existing = await adapter.getPromotion!(voucher.externalPromotionId);
        if (existing && existing.status.toLowerCase() !== 'archived') {
          const updated = await this.prisma.loyaltyPosVoucher.update({
            where: { id: voucher.id },
            data: { status: 'ISSUED', issuedAt: voucher.issuedAt ?? new Date() },
            include: { redemption: true },
          });
          return this.toResult(updated, updated.redemption.pointsSpent);
        }
      } catch (e) {
        this.logger.warn(
          `Promo ${voucher.id} existing promotion lookup failed: ${(e as Error).message}`,
        );
      }
    }

    const adapter = await this.buildAdapter(connection, ISSUE_BUDGET_MS);
    this.assertPromotions(adapter);

    const outletId =
      voucher.store.posConnection?.externalOutletId ||
      undefined;
    const amount = Number(voucher.amount);
    const startTime = this.toLightspeedTime(new Date());
    const endTime = this.toLightspeedTime(
      voucher.ttlExpiresAt ?? new Date(Date.now() + VOUCHER_TTL_HOURS * 60 * 60 * 1000),
    );

    let created: { id: string } | null = null;
    try {
      created = await adapter.createPromotion!({
        name: `HOS Loyalty – ${voucher.currency} ${amount.toFixed(2)}`,
        description: `Enchanted Circle redemption ${voucher.redemptionId}`,
        startTime,
        endTime,
        outletIds: outletId ? [outletId] : undefined,
        channels: ['Register'],
        promoCode: voucher.promoCode || voucher.cardNumber,
        promoCodeLimit: 1,
        discountType: 'basic_fixed_discount',
        discountValue: amount,
        loyaltyMultiplier: 0,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Promotion create failed';
      this.logger.warn(`POS promo ${voucher.id} issue failed: ${msg}`);
      await this.prisma.loyaltyPosVoucher.update({
        where: { id: voucher.id },
        data: {
          status: 'FAILED',
          metadata: { lastError: msg.slice(0, 500) } as Prisma.InputJsonValue,
        },
      });
      let restored = false;
      try {
        await this.reverseBurn(
          voucher.membershipId,
          voucher.redemption.pointsSpent,
          voucher.redemptionId,
          voucher.storeId,
        );
        restored = true;
      } catch (revErr) {
        this.logger.error(
          `Failed to reverse burn for promo ${voucher.id}: ${(revErr as Error).message}`,
        );
      }
      throw new ServiceUnavailableException(
        restored
          ? `Failed to issue POS promo code: ${msg}. Points have been restored. Retry with voucherId=${voucher.id}`
          : `Failed to issue POS promo code: ${msg}. Points were NOT restored. Retry with voucherId=${voucher.id}`,
      );
    }

    try {
      const updated = await this.prisma.loyaltyPosVoucher.update({
        where: { id: voucher.id },
        data: {
          status: 'ISSUED',
          externalPromotionId: created.id,
          issuedAt: new Date(),
          ttlExpiresAt:
            voucher.ttlExpiresAt ?? new Date(Date.now() + VOUCHER_TTL_HOURS * 60 * 60 * 1000),
        },
        include: { redemption: true },
      });
      return this.toResult(updated, updated.redemption.pointsSpent);
    } catch (persistErr) {
      const msg = persistErr instanceof Error ? persistErr.message : 'Failed to record promotion';
      this.logger.error(
        `POS promo ${voucher.id} created in Lightspeed (${created.id}) but HOS persist failed: ${msg} — points NOT restored`,
      );
      try {
        await this.prisma.loyaltyPosVoucher.update({
          where: { id: voucher.id },
          data: {
            externalPromotionId: created.id,
            metadata: { lastError: msg.slice(0, 500) } as Prisma.InputJsonValue,
          },
        });
      } catch (recordErr) {
        this.logger.error(
          `POS promo ${voucher.id} could not save Lightspeed promotion id ${created.id}: ${(recordErr as Error).message}`,
        );
      }
      throw new ServiceUnavailableException(
        `Promo code was created in Lightspeed but HOS could not record it. Points were not restored. Retry with voucherId=${voucher.id}`,
      );
    }
  }

  private toLightspeedTime(d: Date): string {
    return d.toISOString().replace(/\.\d{3}Z$/, '');
  }

  private assertPromotions(adapter: POSAdapter): void {
    if (typeof adapter.createPromotion !== 'function') {
      throw new BadRequestException('POS provider does not support Lightspeed promotions');
    }
  }

  private async buildAdapter(
    connection: { provider: string; credentials: string },
    budgetMs?: number,
  ): Promise<POSAdapter> {
    const creds = this.encryption.decryptJson<Record<string, unknown>>(connection.credentials);
    const adapter = this.factory.create(connection.provider, connection.credentials);
    if (budgetMs != null) adapter.setRequestDeadline?.(Date.now() + budgetMs);
    await adapter.authenticate(creds);
    return adapter;
  }

  private async resolveRedeemValue(
    storeValue: Decimal | number | null | undefined,
  ): Promise<number> {
    if (storeValue != null) {
      const n = Number(storeValue);
      if (Number.isFinite(n) && n > 0) return n;
    }
    const { settings } = await this.loyaltySettings.getResolved();
    const fallback = settings.defaultRedeemValue;
    if (!Number.isFinite(fallback) || fallback <= 0) return 0.01;
    return fallback;
  }

  private async assertAmountLimits(amount: number, currency: string): Promise<void> {
    const { settings } = await this.loyaltySettings.getResolved();
    const min = settings.posVoucherMinAmount;
    const max = settings.posVoucherMaxAmount;
    if (Number.isFinite(min) && amount < min) {
      throw new BadRequestException(
        `Promo amount ${currency} ${amount.toFixed(2)} is below the minimum ${currency} ${min.toFixed(2)}`,
      );
    }
    if (Number.isFinite(max) && amount > max) {
      throw new BadRequestException(
        `Promo amount ${currency} ${amount.toFixed(2)} exceeds the maximum ${currency} ${max.toFixed(2)}`,
      );
    }
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
      const credit = await this.wallet.applyDelta(tx, membershipId, points, LoyaltyTxType.ADJUST, {
        source: 'POS_VOUCHER_REVERSAL',
        sourceId: redemptionId,
        channel: 'HOS_OUTLET_POS',
        storeId,
        description: 'Reversed POS promo-code issuance failure',
        metadata: { redemptionId },
        idempotencyKey: `burn:reverse:${redemptionId}`,
      });
      if (credit.applied) {
        await tx.loyaltyMembership.update({
          where: { id: membershipId },
          data: { totalPointsRedeemed: { decrement: points } },
        });
      }
      await tx.loyaltyRedemption.update({
        where: { id: redemptionId },
        data: { status: 'REVERSED' },
      });
    });
  }

  private async redebit(
    membershipId: string,
    points: number,
    redemptionId: string,
    storeId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.loyaltyRedemption.findUnique({
        where: { id: redemptionId },
        select: { status: true },
      });
      if (current?.status !== 'REVERSED') return;
      const redebit = await this.wallet.applyDelta(tx, membershipId, -points, LoyaltyTxType.BURN, {
        source: 'POS_VOUCHER_RETRY',
        sourceId: redemptionId,
        channel: 'HOS_OUTLET_POS',
        storeId,
        description: 'Retry POS promo-code issuance',
        idempotencyKey: `burn:redebit:${redemptionId}`,
      });
      if (redebit.applied) {
        await tx.loyaltyMembership.update({
          where: { id: membershipId },
          data: { totalPointsRedeemed: { increment: points } },
        });
      }
      await tx.loyaltyRedemption.update({
        where: { id: redemptionId },
        data: { status: 'COMPLETED' },
      });
    });
  }

  private async resolveMembershipId(dto: RedeemForVoucherDto): Promise<string> {
    if (dto.membershipId) {
      const m = await this.prisma.loyaltyMembership.findUnique({ where: { id: dto.membershipId } });
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
        where: phoneNormalized ? { OR: [{ phoneNormalized }, { phone }] } : { phone },
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
      promoCode?: string | null;
      amount: Decimal | number;
      currency: string;
      status: string;
      ttlExpiresAt?: Date | null;
    },
    points: number,
  ): PosPromoCodeResult {
    const code = voucher.promoCode || voucher.cardNumber;
    return {
      voucherId: voucher.id,
      redemptionId: voucher.redemptionId,
      cardNumber: code,
      promoCode: code,
      amount: Number(voucher.amount),
      currency: voucher.currency,
      status: voucher.status,
      points,
      type: 'PROMO_CODE',
      ttlExpiresAt: voucher.ttlExpiresAt ?? null,
      qrPayload: `hos-promo:${code}:${voucher.id}`,
    };
  }
}
