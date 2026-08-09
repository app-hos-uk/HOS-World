import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LoyaltyTxType, Prisma } from '@prisma/client';
import { SegmentationService } from '../../segmentation/segmentation.service';

/** Prisma transaction client; wallet also needs raw SQL for row locks. */
export type LoyaltyPrismaTx = Prisma.TransactionClient;

export type ApplyDeltaResult = {
  balanceBefore: number;
  balanceAfter: number;
  /** false when an existing row matched idempotencyKey (no balance change). */
  applied: boolean;
};

@Injectable()
export class LoyaltyWalletService {
  constructor(private segmentation: SegmentationService) {}

  /**
   * Takes the same row lock `applyDelta` uses. Callers whose duplicate or cap
   * checks must not race a concurrent award should call this first, so the check
   * and the award are serialised for that membership.
   */
  async lockMembership(tx: LoyaltyPrismaTx, membershipId: string): Promise<void> {
    await tx.$executeRaw(
      Prisma.sql`SELECT 1 FROM loyalty_memberships WHERE id = ${membershipId} FOR UPDATE`,
    );
  }

  async applyDelta(
    tx: LoyaltyPrismaTx,
    membershipId: string,
    delta: number,
    type: LoyaltyTxType,
    fields: {
      source: string;
      sourceId?: string | null;
      channel: string;
      storeId?: string | null;
      sellerId?: string | null;
      description?: string | null;
      earnRuleId?: string | null;
      campaignId?: string | null;
      expiresAt?: Date | null;
      metadata?: Prisma.InputJsonValue | null;
      idempotencyKey?: string | null;
    },
  ): Promise<ApplyDeltaResult> {
    // Serialize balance changes for this membership to prevent lost updates
    // (concurrent debits/credits reading the same balance before write).
    await this.lockMembership(tx, membershipId);

    const idempotencyKey = fields.idempotencyKey ?? undefined;
    if (idempotencyKey) {
      const existing = await tx.loyaltyTransaction.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          balanceBefore: existing.balanceBefore,
          balanceAfter: existing.balanceAfter,
          applied: false,
        };
      }
    }

    const membership = await tx.loyaltyMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership) {
      throw new NotFoundException('Loyalty membership not found');
    }
    const balanceBefore = membership.currentBalance;
    const balanceAfter = balanceBefore + delta;
    if (balanceAfter < 0) {
      throw new BadRequestException('Insufficient loyalty balance');
    }

    await tx.loyaltyMembership.update({
      where: { id: membershipId },
      data: { currentBalance: balanceAfter },
    });

    try {
      await tx.loyaltyTransaction.create({
        data: {
          membershipId,
          type,
          points: delta,
          balanceBefore,
          balanceAfter,
          source: fields.source,
          sourceId: fields.sourceId ?? undefined,
          channel: fields.channel,
          storeId: fields.storeId ?? undefined,
          sellerId: fields.sellerId ?? undefined,
          description: fields.description ?? undefined,
          earnRuleId: fields.earnRuleId ?? undefined,
          campaignId: fields.campaignId ?? undefined,
          expiresAt: fields.expiresAt ?? undefined,
          metadata: fields.metadata ?? undefined,
          idempotencyKey,
        },
      });
    } catch (e) {
      if (
        idempotencyKey &&
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Unique race: restore balance and return the winning row (no-op credit/debit).
        await tx.loyaltyMembership.update({
          where: { id: membershipId },
          data: { currentBalance: balanceBefore },
        });
        const existing = await tx.loyaltyTransaction.findUnique({
          where: { idempotencyKey },
        });
        if (existing) {
          return {
            balanceBefore: existing.balanceBefore,
            balanceAfter: existing.balanceAfter,
            applied: false,
          };
        }
      }
      throw e;
    }

    if (
      type === LoyaltyTxType.EARN ||
      type === LoyaltyTxType.BURN ||
      type === LoyaltyTxType.BONUS
    ) {
      void this.segmentation.touchActivity(membership.userId);
    }

    return { balanceBefore, balanceAfter, applied: true };
  }
}
