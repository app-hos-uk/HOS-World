import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
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
import { MetricsService } from '../../monitoring/metrics.service';
import { isLoyaltyRuntimeEnabled } from '../loyalty-enabled';
import { PosExternalGiftCardService } from './pos-external-gift-card.service';
import { PosVoucherOtpService } from './pos-voucher-otp.service';

const CARD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CARD_LENGTH = 12;
/** Unused in-store vouchers auto-reverse after this TTL (plan default: 4 hours). */
const VOUCHER_TTL_HOURS = 4;

/**
 * Time budgets for the Lightspeed calls in a redemption. Staff are at the till with a
 * customer, so the endpoint must answer while the caller is still listening — an
 * unbounded flow completes after the HTTP client has timed out, leaving staff with an
 * error for a voucher that was in fact issued.
 *
 * Each phase gets its own budget: the recovery phase must still run after issuance has
 * spent its own, since it decides whether points may be safely restored.
 */
const ISSUE_BUDGET_MS = 20_000;
const FUNDED_CHECK_BUDGET_MS = 8_000;
const VOID_BUDGET_MS = 6_000;

export type RedeemVoucherContext = {
  staffUserId?: string;
  issuedByUserId?: string;
  terminalId?: string;
  /** When true, staff must have verified OTP before burn. */
  staffAssisted?: boolean;
  otpCode?: string;
};

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
    private metrics: MetricsService,
    private loyaltySettings: LoyaltySettingsService,
    private platformRegion: PlatformRegionService,
    private externalGiftCards: PosExternalGiftCardService,
    private otp: PosVoucherOtpService,
  ) {}

  async assertVoucherEnabled(): Promise<void> {
    if (!isLoyaltyRuntimeEnabled(this.config, this.featureFlags)) {
      throw new BadRequestException('Loyalty programme is not enabled');
    }
    const { settings } = await this.loyaltySettings.getResolved();
    if (!settings.posVoucherEnabled) {
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

  async redeemForVoucher(
    dto: RedeemForVoucherDto,
    ctx: RedeemVoucherContext = {},
  ): Promise<{
    voucherId: string;
    redemptionId: string;
    cardNumber: string;
    amount: number;
    currency: string;
    status: string;
    points: number;
    ttlExpiresAt?: Date | null;
    qrPayload?: string;
  }> {
    await this.assertVoucherEnabled();

    if (dto.voucherId) {
      return this.retryFailedVoucher(dto.voucherId, dto.storeId);
    }

    const idempotencyKey = dto.idempotencyKey?.trim();
    if (!idempotencyKey || idempotencyKey.length < 8) {
      throw new BadRequestException(
        'idempotencyKey of at least 8 characters is required (e.g. terminal id + till sale reference) so a repeated request cannot burn points twice',
      );
    }

    const membershipId = await this.resolveMembershipId(dto);

    if (ctx.staffAssisted) {
      if (!ctx.staffUserId) {
        throw new BadRequestException('staffUserId is required for staff-assisted redemption');
      }
      if (!dto.terminalId?.trim()) {
        throw new BadRequestException('terminalId is required for staff-assisted redemption');
      }
      if (dto.otpCode) {
        await this.otp.verifyOtp({
          membershipId,
          storeId: dto.storeId,
          staffUserId: ctx.staffUserId,
          code: dto.otpCode,
        });
      } else {
        await this.otp.assertStaffOtpVerified({
          membershipId,
          storeId: dto.storeId,
          staffUserId: ctx.staffUserId,
        });
      }
    }
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
    const amount = this.roundMoney(dto.points * redeemValue);
    if (amount <= 0) {
      throw new BadRequestException('Redemption amount must be greater than zero');
    }
    const currency = store.currency || (await this.platformRegion.getCurrency());

    // Check for a prior burn via the wallet key before validating limits or calling
    // the burn engine, so idempotent replays succeed regardless of config changes.
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
        // Scoped by store: idempotency keys are client-supplied and predictable
        // (`terminalId:tillSaleRef`), so an unscoped replay would hand one store's
        // gift card number to staff at another.
        return this.retryFailedVoucher(priorVoucher.id, dto.storeId);
      }
      // Burn exists but voucher row is missing (crash between burn and voucher create).
      // Only recover if the redemption is still COMPLETED — if it was REVERSED,
      // points were restored and we must re-burn via the normal flow below.
      const priorRedemption = await this.prisma.loyaltyRedemption.findUnique({
        where: { id: priorWalletTx.sourceId },
        select: { status: true },
      });
      if (priorRedemption && priorRedemption.status !== 'REVERSED') {
        return this.createAndIssueVoucher({
          membershipId,
          redemptionId: priorWalletTx.sourceId,
          storeId: dto.storeId,
          amount,
          currency,
          posConnection: store.posConnection!,
          audit: this.auditFromContext(ctx, dto.terminalId),
        });
      }
      // Redemption was reversed or missing — fall through to re-burn below.
    }

    await this.assertGiftCardAmountLimits(amount, currency);

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
      return this.retryFailedVoucher(existingVoucher.id, dto.storeId);
    }

    return this.createAndIssueVoucher({
      membershipId,
      redemptionId,
      storeId: dto.storeId,
      amount,
      currency,
      posConnection: store.posConnection!,
      reverseBurnOnCreateFailure: { points: dto.points },
      audit: this.auditFromContext(ctx, dto.terminalId),
    });
  }

  /** Flow A1 — customer-initiated in-store redeem (JWT member). */
  async redeemInStoreForCustomer(
    userId: string,
    dto: { points: number; storeId: string; idempotencyKey?: string },
  ) {
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
    });
    if (!membership) throw new NotFoundException('Loyalty membership not found');

    const idempotencyKey = dto.idempotencyKey?.trim();
    if (!idempotencyKey) {
      throw new BadRequestException('idempotencyKey is required');
    }

    return this.redeemForVoucher(
      {
        points: dto.points,
        storeId: dto.storeId,
        membershipId: membership.id,
        idempotencyKey,
      },
      { issuedByUserId: userId, staffAssisted: false },
    );
  }

  private auditFromContext(
    ctx: RedeemVoucherContext,
    terminalId?: string,
  ): {
    staffUserId?: string;
    issuedByUserId?: string;
    terminalId?: string;
  } {
    return {
      staffUserId: ctx.staffUserId,
      issuedByUserId: ctx.issuedByUserId ?? ctx.staffUserId,
      terminalId: terminalId?.trim() || ctx.terminalId,
    };
  }

  /**
   * Create a PENDING voucher row and issue the gift card.
   * Used for both new redemptions and recovery when the burn exists but the voucher row is missing.
   */
  private async createAndIssueVoucher(params: {
    membershipId: string;
    redemptionId: string;
    storeId: string;
    amount: number;
    currency: string;
    posConnection: { provider: string; credentials: string };
    reverseBurnOnCreateFailure?: { points: number };
    audit?: { staffUserId?: string; issuedByUserId?: string; terminalId?: string };
  }): Promise<{
    voucherId: string;
    redemptionId: string;
    cardNumber: string;
    amount: number;
    currency: string;
    status: string;
    points: number;
    ttlExpiresAt?: Date | null;
    qrPayload?: string;
  }> {
    const cardNumber = this.generateCardNumber();
    const ttlExpiresAt = new Date(Date.now() + VOUCHER_TTL_HOURS * 60 * 60 * 1000);

    let voucher;
    try {
      voucher = await this.prisma.loyaltyPosVoucher.create({
        data: {
          membershipId: params.membershipId,
          redemptionId: params.redemptionId,
          storeId: params.storeId,
          cardNumber,
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
      // Concurrent create: another request already owns this redemption — resume it.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.prisma.loyaltyPosVoucher.findUnique({
          where: { redemptionId: params.redemptionId },
          select: { id: true },
        });
        if (existing) {
          return this.retryFailedVoucher(existing.id, params.storeId);
        }
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

    return this.issueGiftCardForVoucher(voucher.id, params.posConnection);
  }

  /**
   * Retry a FAILED/PENDING voucher: same clientId + cardNumber; re-debit points if burn was reversed.
   *
   * `expectedStoreId` scopes the lookup to one store. Callers acting on behalf of store staff
   * must pass it: the result carries the gift card number, which is bearer value spendable at
   * any till. Admin callers omit it deliberately to retry across stores.
   */
  async retryFailedVoucher(
    voucherId: string,
    expectedStoreId?: string,
  ): Promise<{
    voucherId: string;
    redemptionId: string;
    cardNumber: string;
    amount: number;
    currency: string;
    status: string;
    points: number;
  }> {
    await this.assertVoucherEnabled();

    const voucher = await this.prisma.loyaltyPosVoucher.findUnique({
      where: { id: voucherId },
      include: {
        redemption: true,
        store: { include: { posConnection: true } },
      },
    });
    if (!voucher) throw new NotFoundException('Voucher not found');
    // Identical error to a missing voucher on purpose: a distinguishable response would let
    // staff probe whether a voucher id (or a guessed idempotency key) exists at another store.
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

    // The prior attempt failed with a Lightspeed 403 — only block retries if the POS
    // connection has not been updated since the failure (i.e. admin has not reconnected).
    const meta = voucher.metadata as Record<string, unknown> | null;
    if (meta?.lightspeedPermission === true) {
      const failedAt = typeof meta.failedAt === 'string' ? new Date(meta.failedAt) : null;
      const connUpdated = voucher.store.posConnection?.updatedAt;
      const reconnectedSinceFailure =
        failedAt && connUpdated && connUpdated.getTime() > failedAt.getTime();
      if (!reconnectedSinceFailure) {
        throw new ForbiddenException(
          'The previous attempt failed because the Lightspeed POS user does not have gift card management permissions. ' +
            'An admin must fix the Lightspeed user role or reconnect the POS before retrying.',
        );
      }
      this.logger.log(
        `POS voucher ${voucher.id}: POS connection updated after permission failure — allowing retry`,
      );
    }

    const points = voucher.redemption.pointsSpent;

    if (voucher.redemption.status === 'REVERSED') {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.loyaltyRedemption.findUnique({
          where: { id: voucher.redemptionId },
          select: { status: true },
        });
        if (current?.status !== 'REVERSED') {
          await tx.loyaltyPosVoucher.update({
            where: { id: voucher.id },
            data: { status: 'PENDING' },
          });
          return;
        }

        const redebit = await this.wallet.applyDelta(
          tx,
          voucher.membershipId,
          -points,
          LoyaltyTxType.BURN,
          {
            source: 'POS_VOUCHER_RETRY',
            sourceId: voucher.redemptionId,
            channel: 'HOS_OUTLET_POS',
            storeId: voucher.storeId,
            description: 'Retry POS voucher issuance',
            metadata: { voucherId: voucher.id, clientId: voucher.clientId },
            idempotencyKey: `burn:redebit:${voucher.redemptionId}`,
          },
        );
        if (redebit.applied) {
          await tx.loyaltyMembership.update({
            where: { id: voucher.membershipId },
            data: { totalPointsRedeemed: { increment: points } },
          });
        }
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
      // Claim FAILED → PENDING atomically so concurrent retries don't double-issue.
      const claimed = await this.prisma.loyaltyPosVoucher.updateMany({
        where: { id: voucher.id, status: 'FAILED' },
        data: { status: 'PENDING' },
      });
      if (claimed.count === 0) {
        const latest = await this.prisma.loyaltyPosVoucher.findUnique({
          where: { id: voucher.id },
          include: { redemption: true },
        });
        if (latest?.status === 'ISSUED') {
          return this.toResult(latest, latest.redemption.pointsSpent);
        }
      }
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
    if (voucher.status === 'ISSUED') {
      return this.toResult(voucher, voucher.redemption.pointsSpent);
    }

    const amount = Number(voucher.amount);
    const adapter = await this.buildAdapter(connection, ISSUE_BUDGET_MS);

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
          ttlExpiresAt: voucher.ttlExpiresAt ?? new Date(Date.now() + VOUCHER_TTL_HOURS * 60 * 60 * 1000),
        },
        include: { redemption: true },
      });
      this.metrics.incrementCounter('loyalty_pos_voucher_issued_total');
      await this.externalGiftCards.ensurePointerForVoucher(updated.id).catch((err) => {
        this.logger.warn(`External gift card pointer failed for ${updated.id}: ${(err as Error).message}`);
      });

      return this.toResult(updated, updated.redemption.pointsSpent);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gift card issuance failed';
      this.logger.warn(
        `POS voucher ${voucher.id} gift card issue failed (clientId=${voucher.clientId}): ${msg}`,
      );

      // Lightspeed 403 = the OAuth user/token lacks gift card management permissions.
      // The card may have been created (ACTIVATION) before a subsequent giftCardTransaction
      // failed, so we must check Lightspeed before deciding on point reversal.
      if (this.isLightspeedPermissionError(msg)) {
        this.setBudget(adapter, FUNDED_CHECK_BUDGET_MS);
        const funding = await this.getGiftCardFundingState(
          adapter,
          voucher.cardNumber,
          amount,
          voucher.clientId,
        );

        if (funding.state === 'FUNDED') {
          const updated = await this.prisma.loyaltyPosVoucher.update({
            where: { id: voucher.id },
            data: {
              status: 'ISSUED',
              externalTransactionId: funding.externalTransactionId,
              issuedAt: new Date(),
              metadata: {
                recoveredAfterError: msg.slice(0, 500),
                lightspeedPermission: true,
              } as Prisma.InputJsonValue,
            },
            include: { redemption: true },
          });
          this.metrics.incrementCounter('loyalty_pos_voucher_issued_total');
          this.logger.warn(
            `POS voucher ${voucher.id}: Lightspeed card funded despite 403 — marked ISSUED, burn kept`,
          );
          return this.toResult(updated, updated.redemption.pointsSpent);
        }

        let pointsRestored = false;
        await this.prisma.loyaltyPosVoucher.update({
          where: { id: voucher.id },
          data: {
            status: 'FAILED',
            metadata: {
              lastError: msg.slice(0, 500),
              lightspeedPermission: true,
              failedAt: new Date().toISOString(),
            } as Prisma.InputJsonValue,
          },
        });
        this.metrics.incrementCounter('loyalty_pos_voucher_failed_total');

        if (funding.state === 'NOT_FUNDED') {
          try {
            await this.reverseBurn(
              voucher.membershipId,
              voucher.redemption.pointsSpent,
              voucher.redemptionId,
              voucher.storeId,
            );
            pointsRestored = true;
          } catch (revErr) {
            this.logger.error(
              `Failed to reverse burn for voucher ${voucher.id}: ${
                revErr instanceof Error ? revErr.message : 'unknown'
              }`,
            );
          }
        } else {
          this.logger.warn(
            `POS voucher ${voucher.id}: funding state UNKNOWN after 403 — keeping burn to avoid double-spend`,
          );
        }

        const pointsMsg = pointsRestored
          ? 'Points have been restored.'
          : funding.state === 'UNKNOWN'
            ? 'Points were NOT restored because we could not confirm the gift card is empty — contact support.'
            : 'Points could not be restored automatically — contact support.';

        throw new ForbiddenException(
          'The Lightspeed POS user connected to this store does not have permission to manage gift cards. ' +
            'An admin must update the Lightspeed user role to include gift card management, or reconnect the POS with a user that has this permission. ' +
            pointsMsg,
        );
      }

      // Establish what Lightspeed holds before deciding whether points may go back.
      // Fresh budget: issuance may have exhausted its own, and skipping this check
      // would risk restoring points for a card that is actually funded.
      this.setBudget(adapter, FUNDED_CHECK_BUDGET_MS);
      const funding = await this.getGiftCardFundingState(
        adapter,
        voucher.cardNumber,
        amount,
        voucher.clientId,
      );

      if (funding.state === 'FUNDED') {
        // Partial success: mark ISSUED, keep burn — do not reverse points.
        const updated = await this.prisma.loyaltyPosVoucher.update({
          where: { id: voucher.id },
          data: {
            status: 'ISSUED',
            externalTransactionId: funding.externalTransactionId,
            issuedAt: new Date(),
            metadata: {
              recoveredAfterError: msg.slice(0, 500),
            } as Prisma.InputJsonValue,
          },
          include: { redemption: true },
        });
        this.metrics.incrementCounter('loyalty_pos_voucher_issued_total');
        this.logger.warn(
          `POS voucher ${voucher.id}: Lightspeed card already funded after error — marked ISSUED, burn kept`,
        );
        return this.toResult(updated, updated.redemption.pointsSpent);
      }

      // Funding could not be established. Leave the card alone and keep the burn: a
      // retry re-uses the same clientId, so it resolves to the original card whether or
      // not it was funded. Restoring points here could pair them with a funded card.
      if (funding.state === 'UNKNOWN') {
        await this.prisma.loyaltyPosVoucher.update({
          where: { id: voucher.id },
          data: {
            status: 'FAILED',
            metadata: {
              lastError: msg.slice(0, 500),
              fundingUnverified: funding.reason?.slice(0, 500) ?? true,
              needsManualReview: true,
            } as Prisma.InputJsonValue,
          },
        });
        this.metrics.incrementCounter('loyalty_pos_voucher_failed_total');
        this.metrics.incrementCounter('loyalty_pos_voucher_funding_unverified_total');
        this.logger.error(
          `POS voucher ${voucher.id}: could not verify Lightspeed funding (${funding.reason}) — points kept, flagged for review`,
        );
        throw new ServiceUnavailableException(
          `Failed to issue POS gift card: ${msg}. Lightspeed could not be reached to confirm the card, so points were NOT restored — retry with voucherId=${voucher.id}`,
        );
      }

      // Confirmed unfunded: void the empty card, then it is safe to restore points.
      try {
        this.setBudget(adapter, VOID_BUDGET_MS);
        await adapter.voidGiftCard(voucher.cardNumber);
      } catch (voidErr) {
        this.logger.warn(
          `POS voucher ${voucher.id}: void after failure: ${
            voidErr instanceof Error ? voidErr.message : 'unknown'
          }`,
        );
      }

      await this.prisma.loyaltyPosVoucher.update({
        where: { id: voucher.id },
        data: {
          status: 'FAILED',
          metadata: { lastError: msg.slice(0, 500) } as Prisma.InputJsonValue,
        },
      });
      this.metrics.incrementCounter('loyalty_pos_voucher_failed_total');

      let generalPointsRestored = false;
      try {
        await this.reverseBurn(
          voucher.membershipId,
          voucher.redemption.pointsSpent,
          voucher.redemptionId,
          voucher.storeId,
        );
        generalPointsRestored = true;
      } catch (revErr) {
        this.logger.error(
          `Failed to reverse burn for voucher ${voucher.id}: ${
            revErr instanceof Error ? revErr.message : 'unknown'
          }`,
        );
      }

      const restoredSuffix = generalPointsRestored
        ? 'Points have been restored.'
        : 'Points could not be restored automatically — contact support.';

      // Upstream auth (403) or validation (400–422) errors are permanent — surface as
      // 422 so the client does not auto-retry a non-transient failure.
      const upstreamStatus = this.extractLightspeedStatus(msg);
      if (upstreamStatus !== null && upstreamStatus >= 400 && upstreamStatus < 500) {
        throw new UnprocessableEntityException(
          `Lightspeed rejected the gift card request (${upstreamStatus}): ${msg}. ${restoredSuffix} Retry with voucherId=${voucher.id}`,
        );
      }

      throw new ServiceUnavailableException(
        `Failed to issue POS gift card: ${msg}. ${restoredSuffix} Retry with voucherId=${voucher.id}`,
      );
    }
  }

  /**
   * Create a new card, or reload if the number already exists (retry / partial success).
   * Always uses the same clientId for RELOADING idempotency.
   * Never treat an unrelated balance as our funding without a matching clientId.
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
    // Prefer a transaction tagged with our clientId; ACTIVATION may not carry it.
    const byClient = created.transactions?.find((t) => t.clientId === clientId);
    const activation = created.transactions?.find((t) => t.type === 'ACTIVATION');
    return {
      externalTransactionId: byClient?.id || activation?.id || created.id,
      expiresAt: created.expiresAt ? new Date(created.expiresAt) : null,
    };
  }

  /**
   * Whether Lightspeed already holds our funded value for this clientId.
   *
   * UNKNOWN is deliberately distinct from NOT_FUNDED: if we cannot reach Lightspeed we
   * must not assume the card is empty, because voiding is best-effort and restoring the
   * points on top of a card that is in fact funded hands out the value twice.
   */
  private async getGiftCardFundingState(
    adapter: POSAdapter,
    cardNumber: string,
    amount: number,
    clientId: string,
  ): Promise<{
    state: 'FUNDED' | 'NOT_FUNDED' | 'UNKNOWN';
    externalTransactionId?: string;
    reason?: string;
  }> {
    try {
      const existing = await adapter.getGiftCardByNumber(cardNumber);
      if (!existing) return { state: 'NOT_FUNDED' };
      const prior = existing.transactions?.find((t) => t.clientId === clientId);
      if (prior?.id) {
        return { state: 'FUNDED', externalTransactionId: prior.id };
      }
      // Fresh create often funds via ACTIVATION without clientId — accept only when
      // balance matches and there are no other client-tagged txs (our card number).
      const hasOtherClient = existing.transactions?.some(
        (t) => t.clientId && t.clientId !== clientId,
      );
      if (!hasOtherClient && Number(existing.balance) >= amount - 0.001) {
        const activation = existing.transactions?.find((t) => t.type === 'ACTIVATION');
        return {
          state: 'FUNDED',
          externalTransactionId: activation?.id || existing.id,
        };
      }
      return { state: 'NOT_FUNDED' };
    } catch (e) {
      return {
        state: 'UNKNOWN',
        reason: e instanceof Error ? e.message : 'gift card lookup failed',
      };
    }
  }

  private async buildAdapter(
    connection: {
      provider: string;
      credentials: string;
    },
    budgetMs?: number,
  ): Promise<POSAdapter> {
    const creds = this.encryption.decryptJson<Record<string, unknown>>(connection.credentials);
    const adapter = this.factory.create(connection.provider, connection.credentials);
    if (budgetMs != null) {
      this.setBudget(adapter, budgetMs);
    }
    await adapter.authenticate(creds);
    return adapter;
  }

  /** Give the adapter a fresh budget for the next phase of work. */
  private setBudget(adapter: POSAdapter, budgetMs: number): void {
    adapter.setRequestDeadline?.(Date.now() + budgetMs);
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
    return Number.isFinite(fallback) && fallback > 0 ? fallback : 0.01;
  }

  /**
   * Validate against Lightspeed gift card amount limits.
   * Lightspeed rejects gift cards below and above configurable thresholds.
   */
  private async assertGiftCardAmountLimits(amount: number, currency: string): Promise<void> {
    const { settings } = await this.loyaltySettings.getResolved();
    const min = settings.posVoucherMinAmount;
    const max = settings.posVoucherMaxAmount;
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

      const credit = await this.wallet.applyDelta(tx, membershipId, points, LoyaltyTxType.ADJUST, {
        source: 'POS_VOUCHER_REVERSAL',
        sourceId: redemptionId,
        channel: 'HOS_OUTLET_POS',
        storeId,
        description: 'Reversed POS voucher issuance failure',
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
        where: phoneNormalized ? { OR: [{ phoneNormalized }, { phone }] } : { phone },
        include: { loyaltyMembership: true },
      });
      if (byPhone?.loyaltyMembership) return byPhone.loyaltyMembership.id;
    }

    throw new NotFoundException('Member not found');
  }

  /** Lightspeed 403 "not authorized to perform action" — permanent permissions gap. */
  private isLightspeedPermissionError(msg: string): boolean {
    return /Lightspeed API 403/i.test(msg) && /not authorized/i.test(msg);
  }

  /** Extract the HTTP status code from a "Lightspeed API NNN: …" error message. */
  private extractLightspeedStatus(msg: string): number | null {
    const m = msg.match(/Lightspeed API (\d{3})/i);
    return m ? Number(m[1]) : null;
  }

  private toResult(
    voucher: {
      id: string;
      redemptionId: string;
      cardNumber: string;
      amount: Decimal | number;
      currency: string;
      status: string;
      ttlExpiresAt?: Date | null;
    },
    points: number,
  ) {
    const qrPayload = `hos-voucher:${voucher.cardNumber}:${voucher.id}`;
    return {
      voucherId: voucher.id,
      redemptionId: voucher.redemptionId,
      cardNumber: voucher.cardNumber,
      amount: Number(voucher.amount),
      currency: voucher.currency,
      status: voucher.status,
      points,
      ttlExpiresAt: voucher.ttlExpiresAt ?? null,
      qrPayload,
    };
  }

  /**
   * Flow A5 — cancel an ISSUED voucher and restore points (customer or manager).
   * Issuer cannot cancel their own staff-issued voucher (separation of duties).
   */
  async cancelVoucher(params: {
    voucherId: string;
    actorUserId: string;
    actorRole: string;
    reason?: string;
  }): Promise<{ status: string; pointsRestored: boolean }> {
    await this.assertVoucherEnabled();

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
    if (
      voucher.staffUserId &&
      voucher.staffUserId === params.actorUserId &&
      isStoreStaff
    ) {
      throw new ForbiddenException('Staff who issued a voucher cannot void it — ask a manager');
    }

    const conn = voucher.store.posConnection;
    if (!conn?.isActive || !conn.credentials) {
      throw new BadRequestException('Store has no active POS connection');
    }

    const adapter = await this.buildAdapter(conn, FUNDED_CHECK_BUDGET_MS);
    const funding = await this.getGiftCardFundingState(
      adapter,
      voucher.cardNumber,
      Number(voucher.amount),
      voucher.clientId,
    );

    if (funding.state === 'FUNDED') {
      const lsCard = await adapter.getGiftCardByNumber(voucher.cardNumber);
      const balance = lsCard ? Number(lsCard.balance) : Number(voucher.amount);
      const original = Number(voucher.amount);
      if (balance < original - 0.01) {
        throw new BadRequestException(
          'Voucher has been partially spent and cannot be cancelled. Remaining balance may be used online.',
        );
      }
    }

    this.setBudget(adapter, VOID_BUDGET_MS);
    try {
      await adapter.voidGiftCard(voucher.cardNumber);
    } catch (e) {
      this.logger.warn(`voidGiftCard on cancel failed for ${voucher.id}: ${(e as Error).message}`);
      throw new BadRequestException('Could not void gift card in Lightspeed — voucher not cancelled');
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
    } catch (burnErr) {
      this.logger.error(
        `Points restore failed after void for ${voucher.id}: ${(burnErr as Error).message}. ` +
          'Gift card is voided — flagging for manual reconciliation.',
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
          ...(pointsRestored ? {} : { pointsRestoreFailed: true }),
        } as Prisma.InputJsonValue,
      },
    });

    await this.externalGiftCards.markPointerCancelled(voucher.id);

    return { status: 'REVERSED', pointsRestored };
  }

  /** Sweeper: auto-reverse unused ISSUED vouchers past ttlExpiresAt. */
  async expireUnusedVouchers(): Promise<number> {
    const now = new Date();
    const expired = await this.prisma.loyaltyPosVoucher.findMany({
      where: {
        status: 'ISSUED',
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
        if (conn?.isActive && conn.credentials) {
          const adapter = await this.buildAdapter(conn, VOID_BUDGET_MS);
          const funding = await this.getGiftCardFundingState(
            adapter,
            voucher.cardNumber,
            Number(voucher.amount),
            voucher.clientId,
          );
          if (funding.state === 'FUNDED') {
            const lsCard = await adapter.getGiftCardByNumber(voucher.cardNumber);
            const balance = lsCard ? Number(lsCard.balance) : 0;
            if (balance < Number(voucher.amount) - 0.01) {
              await this.prisma.loyaltyPosVoucher.update({
                where: { id: voucher.id },
                data: { status: 'RECONCILED' },
              });
              continue;
            }
            try {
              await adapter.voidGiftCard(voucher.cardNumber);
            } catch (voidErr) {
              this.logger.warn(
                `TTL void failed for ${voucher.id}: ${(voidErr as Error).message} — skipping points restore`,
              );
              continue;
            }
          }
        } else {
          this.logger.warn(
            `TTL expire skipped for ${voucher.id}: POS connection inactive — cannot confirm card is voided, points NOT restored`,
          );
          continue;
        }
        await this.reverseBurn(
          voucher.membershipId,
          voucher.redemption.pointsSpent,
          voucher.redemptionId,
          voucher.storeId,
        );
        await this.prisma.loyaltyPosVoucher.update({
          where: { id: voucher.id },
          data: { status: 'REVERSED', reversedAt: now, metadata: { autoExpired: true } as Prisma.InputJsonValue },
        });
        await this.externalGiftCards.markPointerCancelled(voucher.id);
        count++;
      } catch (e) {
        this.logger.warn(`TTL expire failed for ${voucher.id}: ${(e as Error).message}`);
      }
    }
    return count;
  }

  async listActiveVouchersForUser(userId: string) {
    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership) return [];
    const rows = await this.prisma.loyaltyPosVoucher.findMany({
      where: {
        membershipId: membership.id,
        status: { in: ['ISSUED', 'PENDING'] },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map((v) => ({
      id: v.id,
      cardNumber: v.cardNumber,
      amount: Number(v.amount),
      currency: v.currency,
      status: v.status,
      ttlExpiresAt: v.ttlExpiresAt,
      qrPayload: `hos-voucher:${v.cardNumber}:${v.id}`,
    }));
  }
}
