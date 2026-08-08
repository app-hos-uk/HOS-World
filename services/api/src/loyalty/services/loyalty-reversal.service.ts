import { Injectable, Logger } from '@nestjs/common';
import { LoyaltyTxType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { LoyaltyWalletService } from './wallet.service';
import { LoyaltySettingsService } from './loyalty-settings.service';
import { LoyaltyTierEngine } from '../engines/tier.engine';
import { isLoyaltyRuntimeEnabled } from '../loyalty-enabled';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from '../../config/feature-flags.service';

@Injectable()
export class LoyaltyReversalService {
  private readonly logger = new Logger(LoyaltyReversalService.name);

  constructor(
    private prisma: PrismaService,
    private wallet: LoyaltyWalletService,
    private settings: LoyaltySettingsService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
    private tiers: LoyaltyTierEngine,
  ) {}

  async onOrderCancelled(orderId: string): Promise<void> {
    if (!isLoyaltyRuntimeEnabled(this.config, this.featureFlags)) return;

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        loyaltyPointsEarned: true,
        loyaltyPointsRedeemed: true,
        parentOrderId: true,
      },
    });
    if (!order?.userId || order.parentOrderId) return;

    const { settings } = await this.settings.getResolved();
    if (settings.clawEarnOnCancel && order.loyaltyPointsEarned > 0) {
      await this.applyClawEarn(order.userId, order.loyaltyPointsEarned, {
        source: 'ORDER_CANCEL',
        sourceId: order.id,
        description: `Clawback earn for cancelled order ${order.orderNumber}`,
        idempotencyKey: `reverse:ORDER_EARN:${order.id}`,
      });
    }
    if (settings.restoreBurnOnCancel && order.loyaltyPointsRedeemed > 0) {
      await this.applyRestoreBurn(order.userId, order.loyaltyPointsRedeemed, {
        source: 'ORDER_CANCEL_RESTORE_BURN',
        sourceId: order.id,
        description: `Restore burn for cancelled order ${order.orderNumber}`,
        idempotencyKey: `restore:ORDER_BURN:${order.id}`,
      });
    }
  }

  async onReturnRefunded(params: {
    returnId: string;
    orderId: string;
    refundAmount: number;
  }): Promise<void> {
    if (!isLoyaltyRuntimeEnabled(this.config, this.featureFlags)) return;

    const order = await this.prisma.order.findUnique({
      where: { id: params.orderId },
      select: {
        id: true,
        userId: true,
        orderNumber: true,
        total: true,
        loyaltyPointsEarned: true,
        loyaltyPointsRedeemed: true,
        parentOrderId: true,
      },
    });
    if (!order?.userId || order.parentOrderId) return;

    const orderTotal = Number(order.total);
    const share = orderTotal > 0 ? Math.min(1, Math.max(0, params.refundAmount / orderTotal)) : 0;
    if (share <= 0) return;

    const { settings } = await this.settings.getResolved();
    const targetEarnClaw = Math.round(order.loyaltyPointsEarned * share);
    const targetBurnRestore = Math.round(order.loyaltyPointsRedeemed * share);

    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId: order.userId },
      select: { id: true },
    });
    if (!membership) return;

    // Cumulative: GC may settle before Stripe; retries top up to the new target.
    const prior = await this.prisma.loyaltyTransaction.findMany({
      where: {
        membershipId: membership.id,
        sourceId: params.returnId,
        source: { in: ['RETURN_REFUND', 'RETURN_RESTORE_BURN'] },
      },
      select: { source: true, points: true },
    });
    const alreadyClawed = prior
      .filter((t) => t.source === 'RETURN_REFUND')
      .reduce((s, t) => s + Math.abs(t.points), 0);
    const alreadyRestored = prior
      .filter((t) => t.source === 'RETURN_RESTORE_BURN')
      .reduce((s, t) => s + Math.max(0, t.points), 0);

    const earnClaw = Math.max(0, targetEarnClaw - alreadyClawed);
    const burnRestore = Math.max(0, targetBurnRestore - alreadyRestored);

    if (settings.clawEarnOnReturn && earnClaw > 0) {
      await this.applyClawEarn(order.userId, earnClaw, {
        source: 'RETURN_REFUND',
        sourceId: params.returnId,
        description: `Clawback earn for return ${params.returnId} on order ${order.orderNumber}`,
        // The key carries what was clawed before this attempt as well as the target:
        // a clawback capped by a thin balance must still be able to top up later,
        // while a redelivered webhook (same target, same history) stays a no-op.
        idempotencyKey: `reverse:RETURN_EARN:${params.returnId}:${targetEarnClaw}:${alreadyClawed}`,
        metadata: {
          orderId: order.id,
          share,
          refundAmount: params.refundAmount,
          targetPoints: targetEarnClaw,
        },
      });
    }
    if (settings.restoreBurnOnReturn && burnRestore > 0) {
      await this.applyRestoreBurn(order.userId, burnRestore, {
        source: 'RETURN_RESTORE_BURN',
        sourceId: params.returnId,
        description: `Restore burn for return ${params.returnId} on order ${order.orderNumber}`,
        idempotencyKey: `restore:RETURN_BURN:${params.returnId}:${targetBurnRestore}`,
        metadata: {
          orderId: order.id,
          share,
          refundAmount: params.refundAmount,
          targetPoints: targetBurnRestore,
        },
      });
    }
  }

  private async applyClawEarn(
    userId: string,
    points: number,
    fields: {
      source: string;
      sourceId: string;
      description: string;
      idempotencyKey: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership || points <= 0) return;

    try {
      let clawed = false;
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.lockMembership(tx, membership.id);
        const locked = await tx.loyaltyMembership.findUnique({ where: { id: membership.id } });
        if (!locked) return;
        const claw = Math.min(points, locked.currentBalance);
        if (claw <= 0) return;

        const result = await this.wallet.applyDelta(
          tx,
          membership.id,
          -claw,
          LoyaltyTxType.ADJUST,
          {
            source: fields.source,
            sourceId: fields.sourceId,
            channel: 'WEB',
            description: fields.description,
            idempotencyKey: fields.idempotencyKey,
            metadata: {
              ...(typeof fields.metadata === 'object' && fields.metadata ? fields.metadata : {}),
              requestedPoints: points,
              appliedPoints: claw,
            } as Prisma.InputJsonValue,
          },
        );
        if (result.applied) {
          await tx.loyaltyMembership.update({
            where: { id: membership.id },
            data: {
              totalPointsEarned: { decrement: Math.min(claw, locked.totalPointsEarned) },
            },
          });
          clawed = true;
        }
      });
      // Lifetime earned points are the tier basis, so a clawback has to be able
      // to move the member back down.
      if (clawed) {
        await this.tiers.recalculateTier(membership.id);
      }
    } catch (e) {
      this.logger.warn(`Earn clawback failed for ${userId}: ${(e as Error).message}`);
    }
  }

  private async applyRestoreBurn(
    userId: string,
    points: number,
    fields: {
      source: string;
      sourceId: string;
      description: string;
      idempotencyKey: string;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    const membership = await this.prisma.loyaltyMembership.findUnique({ where: { userId } });
    if (!membership || points <= 0) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.wallet.lockMembership(tx, membership.id);
        const locked = await tx.loyaltyMembership.findUnique({ where: { id: membership.id } });
        if (!locked) return;

        const result = await this.wallet.applyDelta(
          tx,
          membership.id,
          points,
          LoyaltyTxType.ADJUST,
          {
            source: fields.source,
            sourceId: fields.sourceId,
            channel: 'WEB',
            description: fields.description,
            idempotencyKey: fields.idempotencyKey,
            metadata: fields.metadata ?? undefined,
          },
        );
        // Giving the points back also un-spends them, otherwise lifetime redeemed
        // keeps counting a redemption the member no longer had.
        if (result.applied) {
          await tx.loyaltyMembership.update({
            where: { id: membership.id },
            data: {
              totalPointsRedeemed: { decrement: Math.min(points, locked.totalPointsRedeemed) },
            },
          });
        }
      });
    } catch (e) {
      this.logger.warn(`Burn restore failed for ${userId}: ${(e as Error).message}`);
    }
  }
}
