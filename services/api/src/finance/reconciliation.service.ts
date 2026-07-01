import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PaymentProviderService } from '../payments/payment-provider.service';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private prisma: PrismaService,
    private paymentProviderService: PaymentProviderService,
  ) {}

  async startReconciliation(params: {
    periodStart: Date;
    periodEnd: Date;
    startedById?: string;
  }) {
    const run = await this.prisma.reconciliationRun.create({
      data: {
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        startedById: params.startedById,
        status: 'RUNNING',
      },
    });

    try {
      // Get internal PAYMENT transactions for the period
      const internalTransactions = await this.prisma.transaction.findMany({
        where: {
          type: 'PAYMENT',
          status: 'COMPLETED',
          createdAt: { gte: params.periodStart, lt: params.periodEnd },
        },
        include: {
          order: { select: { stripePaymentIntentId: true } },
        },
      });

      // Build lookup map by stripePaymentIntentId
      const internalByStripeId = new Map<string, typeof internalTransactions[0]>();
      for (const tx of internalTransactions) {
        const stripeId = tx.order?.stripePaymentIntentId || (tx.metadata as any)?.stripePaymentId;
        if (stripeId) {
          internalByStripeId.set(stripeId, tx);
        }
      }

      // Get Stripe payments for the period (if provider available)
      let stripeCharges: Array<{ id: string; amount: number; currency: string; payment_intent: string }> = [];
      if (this.paymentProviderService.isProviderAvailable('stripe')) {
        try {
          const stripe = this.paymentProviderService.getProvider('stripe');
          const stripeInstance = (stripe as any).getStripeInstance?.();
          if (stripeInstance) {
            const charges = await stripeInstance.charges.list({
              created: {
                gte: Math.floor(params.periodStart.getTime() / 1000),
                lt: Math.floor(params.periodEnd.getTime() / 1000),
              },
              limit: 100,
            });
            stripeCharges = charges.data.map((c: any) => ({
              id: c.id,
              amount: c.amount / 100,
              currency: c.currency.toUpperCase(),
              payment_intent: c.payment_intent,
            }));
          }
        } catch (err: any) {
          this.logger.warn(`Could not fetch Stripe charges: ${err.message}`);
        }
      }

      let matched = 0, mismatched = 0, missingInternal = 0, missingStripe = 0;
      const stripeProcessed = new Set<string>();
      const items: Array<{
        runId: string;
        type: string;
        transactionId?: string;
        stripeChargeId?: string;
        internalAmount?: number;
        stripeAmount?: number;
        currency?: string;
        discrepancyAmount?: number;
      }> = [];

      // Match Stripe charges against internal transactions
      for (const charge of stripeCharges) {
        stripeProcessed.add(charge.payment_intent);
        const internal = internalByStripeId.get(charge.payment_intent);

        if (!internal) {
          missingInternal++;
          items.push({
            runId: run.id,
            type: 'MISSING_INTERNAL',
            stripeChargeId: charge.id,
            stripeAmount: charge.amount,
            currency: charge.currency,
          });
        } else {
          const internalAmt = Number(internal.amount);
          const diff = Math.abs(internalAmt - charge.amount);
          if (diff < 0.02) {
            matched++;
            items.push({
              runId: run.id,
              type: 'MATCHED',
              transactionId: internal.id,
              stripeChargeId: charge.id,
              internalAmount: internalAmt,
              stripeAmount: charge.amount,
              currency: charge.currency,
            });
          } else {
            mismatched++;
            items.push({
              runId: run.id,
              type: 'AMOUNT_MISMATCH',
              transactionId: internal.id,
              stripeChargeId: charge.id,
              internalAmount: internalAmt,
              stripeAmount: charge.amount,
              currency: charge.currency,
              discrepancyAmount: internalAmt - charge.amount,
            });
          }
        }
      }

      // Find internal PAYMENT transactions with no Stripe match
      for (const [stripeId, tx] of internalByStripeId.entries()) {
        if (!stripeProcessed.has(stripeId)) {
          missingStripe++;
          items.push({
            runId: run.id,
            type: 'MISSING_STRIPE',
            transactionId: tx.id,
            internalAmount: Number(tx.amount),
            currency: tx.currency,
          });
        }
      }

      // Reconcile REFUND transactions (internal ledger vs returns)
      const internalRefunds = await this.prisma.transaction.findMany({
        where: {
          type: 'REFUND',
          status: 'COMPLETED',
          createdAt: { gte: params.periodStart, lt: params.periodEnd },
        },
        include: {
          returnRequest: { select: { id: true, refundAmount: true, status: true } },
        },
      });

      for (const refundTx of internalRefunds) {
        const expected = refundTx.returnRequest?.refundAmount
          ? Number(refundTx.returnRequest.refundAmount)
          : Number(refundTx.amount);
        const actual = Number(refundTx.amount);
        const diff = Math.abs(expected - actual);
        if (diff < 0.02) {
          matched++;
          items.push({
            runId: run.id,
            type: 'REFUND_MATCHED',
            transactionId: refundTx.id,
            internalAmount: actual,
            currency: refundTx.currency,
          });
        } else {
          mismatched++;
          items.push({
            runId: run.id,
            type: 'REFUND_MISMATCH',
            transactionId: refundTx.id,
            internalAmount: actual,
            stripeAmount: expected,
            currency: refundTx.currency,
            discrepancyAmount: actual - expected,
          });
        }
      }

      // When Stripe is unavailable, record internal-only summary so runs aren't empty
      if (stripeCharges.length === 0 && internalTransactions.length > 0) {
        for (const tx of internalTransactions) {
          if (!items.some((i) => i.transactionId === tx.id && i.type === 'MATCHED')) {
            items.push({
              runId: run.id,
              type: 'INTERNAL_ONLY',
              transactionId: tx.id,
              internalAmount: Number(tx.amount),
              currency: tx.currency,
            });
          }
        }
      }

      // Batch create items
      if (items.length > 0) {
        await this.prisma.reconciliationItem.createMany({ data: items as any });
      }

      // Update run with results
      const updated = await this.prisma.reconciliationRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          totalMatched: matched,
          totalMismatched: mismatched,
          totalMissing: missingInternal,
          totalExtra: missingStripe,
          completedAt: new Date(),
        },
        include: { items: true },
      });

      this.logger.log(
        `Reconciliation complete: ${matched} matched, ${mismatched} mismatched, ${missingInternal} missing internal, ${missingStripe} missing in Stripe`,
      );
      return updated;
    } catch (err: any) {
      await this.prisma.reconciliationRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', notes: err.message },
      });
      this.logger.error(`Reconciliation failed: ${err.message}`);
      throw err;
    }
  }

  async getRuns(filters?: { status?: string; page?: number; limit?: number }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const where: any = {};
    if (filters?.status) where.status = filters.status;

    const [runs, total] = await Promise.all([
      this.prisma.reconciliationRun.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { startedBy: { select: { email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.reconciliationRun.count({ where }),
    ]);

    return { runs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getRunDetails(runId: string) {
    return this.prisma.reconciliationRun.findUnique({
      where: { id: runId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        startedBy: { select: { email: true, firstName: true, lastName: true } },
      },
    });
  }

  async resolveItem(itemId: string, resolvedById: string, resolution: string) {
    return this.prisma.reconciliationItem.update({
      where: { id: itemId },
      data: {
        status: 'RESOLVED',
        resolvedById,
        resolvedAt: new Date(),
        resolution,
      },
    });
  }

  async ignoreItem(itemId: string, resolvedById: string, reason: string) {
    return this.prisma.reconciliationItem.update({
      where: { id: itemId },
      data: {
        status: 'IGNORED',
        resolvedById,
        resolvedAt: new Date(),
        resolution: reason,
      },
    });
  }
}
