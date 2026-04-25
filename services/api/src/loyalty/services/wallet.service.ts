import { Injectable } from '@nestjs/common';
import { LoyaltyTxType, Prisma } from '@prisma/client';
import { SegmentationService } from '../../segmentation/segmentation.service';

/** Prisma transaction client; wallet also needs raw SQL for row locks. */
export type LoyaltyPrismaTx = Prisma.TransactionClient;

@Injectable()
export class LoyaltyWalletService {
  constructor(private segmentation: SegmentationService) {}

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
    },
  ): Promise<{ balanceBefore: number; balanceAfter: number }> {
    // Serialize balance changes for this membership to prevent lost updates
    // (concurrent debits/ credits reading the same balance before write).
    await tx.$executeRaw(
      Prisma.sql`SELECT 1 FROM loyalty_memberships WHERE id = ${membershipId}::uuid FOR UPDATE`,
    );

    const membership = await tx.loyaltyMembership.findUnique({
      where: { id: membershipId },
    });
    if (!membership) {
      throw new Error('Loyalty membership not found');
    }
    const balanceBefore = membership.currentBalance;
    const balanceAfter = balanceBefore + delta;
    if (balanceAfter < 0) {
      throw new Error('Insufficient loyalty balance');
    }

    await tx.loyaltyMembership.update({
      where: { id: membershipId },
      data: { currentBalance: balanceAfter },
    });

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
      },
    });

    if (type === LoyaltyTxType.EARN || type === LoyaltyTxType.BURN || type === LoyaltyTxType.BONUS) {
      void this.segmentation.touchActivity(membership.userId);
    }

    return { balanceBefore, balanceAfter };
  }
}
