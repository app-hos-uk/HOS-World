import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Optional,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TransactionsService } from './transactions.service';
import { VendorLedgerService } from '../vendor-ledger/vendor-ledger.service';
import { PLATFORM_DEFAULT_CURRENCY } from '../common/currency-defaults';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  constructor(
    private prisma: PrismaService,
    private transactionsService: TransactionsService,
    @Optional() private vendorLedgerService?: VendorLedgerService,
  ) {}

  async schedulePayout(data: {
    sellerId: string;
    amount: number;
    currency?: string;
    paymentMethod?: string;
    scheduledDate?: Date;
    description?: string;
  }) {
    const seller = await this.prisma.seller.findUnique({
      where: { id: data.sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Create transaction for payout
    const transaction = await this.transactionsService.createTransaction({
      type: 'PAYOUT',
      amount: data.amount,
      currency: data.currency || PLATFORM_DEFAULT_CURRENCY,
      sellerId: data.sellerId,
      description: data.description || `Payout to ${seller.storeName}`,
      status: data.scheduledDate && data.scheduledDate > new Date() ? 'PENDING' : 'PENDING',
      metadata: {
        paymentMethod: data.paymentMethod,
        scheduledDate: data.scheduledDate,
      },
    });

    return transaction;
  }

  async processPayout(transactionId: string) {
    return this.prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (transaction.type !== 'PAYOUT') {
        throw new BadRequestException('Transaction is not a payout');
      }

      if (transaction.status !== 'PENDING') {
        throw new BadRequestException('Payout has already been processed');
      }

      if (transaction.sellerId && this.vendorLedgerService) {
        await this.vendorLedgerService.recordPayout(
          {
            sellerId: transaction.sellerId,
            amount: Number(transaction.amount),
            referenceId: transactionId,
            currency: transaction.currency || PLATFORM_DEFAULT_CURRENCY,
          },
          { tx },
        );
      }

      // Ensure Settlements / Seller Earnings see this completed payout as PAID
      const settlementId = await this.ensurePaidSettlementForPayout(tx, transaction);

      const updated = await tx.transaction.update({
        where: { id: transactionId },
        data: {
          status: 'COMPLETED',
          ...(settlementId ? { settlementId } : {}),
        },
        include: {
          seller: {
            select: { id: true, storeName: true, slug: true },
          },
          customer: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          settlement: true,
        },
      });

      await tx.transactionAuditLog.create({
        data: {
          transactionId,
          previousStatus: 'PENDING',
          newStatus: 'COMPLETED',
          reason: 'Payout processed',
          metadata: settlementId ? { settlementId } : undefined,
        },
      });

      return updated;
    });
  }

  /**
   * When finance marks a PAYOUT transaction Completed, create or update a
   * Settlement with status PAID so admin Settlements and seller Earnings APIs
   * return the payout.
   */
  private async ensurePaidSettlementForPayout(
    tx: any,
    transaction: {
      id: string;
      sellerId: string | null;
      amount: unknown;
      currency: string;
      settlementId: string | null;
      description: string | null;
      metadata: unknown;
      createdAt: Date;
    },
  ): Promise<string | null> {
    if (!transaction.sellerId) {
      this.logger.warn(`Payout ${transaction.id} has no sellerId — skipping settlement link`);
      return null;
    }

    const netAmount = Number(transaction.amount);
    const currency = transaction.currency || PLATFORM_DEFAULT_CURRENCY;
    const meta = (transaction.metadata || {}) as {
      paymentMethod?: string;
      scheduledDate?: string | Date;
      periodStart?: string | Date;
      periodEnd?: string | Date;
    };
    const paidAt = new Date();
    const periodEnd = meta.periodEnd
      ? new Date(meta.periodEnd)
      : meta.scheduledDate
        ? new Date(meta.scheduledDate)
        : paidAt;
    const periodStart = meta.periodStart
      ? new Date(meta.periodStart)
      : new Date(periodEnd.getTime() - 7 * 24 * 60 * 60 * 1000);

    if (transaction.settlementId) {
      await tx.settlement.update({
        where: { id: transaction.settlementId },
        data: {
          status: 'PAID',
          paidAt,
          paymentMethod: meta.paymentMethod || 'MANUAL_PAYOUT',
          notes: transaction.description
            ? `Linked payout ${transaction.id}: ${transaction.description}`
            : `Linked payout ${transaction.id}`,
        },
      });
      return transaction.settlementId;
    }

    // Prefer marking an existing PENDING/PROCESSING settlement for this seller
    const existing = await tx.settlement.findFirst({
      where: {
        sellerId: transaction.sellerId,
        status: { in: ['PENDING', 'PROCESSING'] },
        netAmount: netAmount,
        currency,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await tx.settlement.update({
        where: { id: existing.id },
        data: {
          status: 'PAID',
          paidAt,
          paymentMethod: meta.paymentMethod || 'MANUAL_PAYOUT',
          notes: [existing.notes, `Paid via payout transaction ${transaction.id}`]
            .filter(Boolean)
            .join('\n'),
        },
      });
      return existing.id;
    }

    const settlement = await tx.settlement.create({
      data: {
        sellerId: transaction.sellerId,
        periodStart,
        periodEnd,
        totalSales: netAmount,
        totalOrders: 0,
        platformFee: 0,
        netAmount,
        currency,
        status: 'PAID',
        paymentMethod: meta.paymentMethod || 'MANUAL_PAYOUT',
        paidAt,
        notes: transaction.description
          ? `Auto-created from completed payout ${transaction.id}: ${transaction.description}`
          : `Auto-created from completed payout ${transaction.id}`,
      },
    });

    this.logger.log(
      `Created PAID settlement ${settlement.id} for payout ${transaction.id} (seller ${transaction.sellerId})`,
    );
    return settlement.id;
  }

  async getPayouts(filters?: {
    sellerId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }) {
    // UI uses PAID; ledger uses COMPLETED
    const status =
      filters?.status === 'PAID'
        ? 'COMPLETED'
        : filters?.status === 'PROCESSING'
          ? 'PENDING'
          : filters?.status;

    return this.transactionsService.getTransactions({
      ...filters,
      status,
      type: 'PAYOUT',
    });
  }

  async getSellerPayoutHistory(
    sellerId: string,
    filters?: {
      status?: string;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    },
  ) {
    return this.getPayouts({
      ...filters,
      sellerId,
    });
  }
}
