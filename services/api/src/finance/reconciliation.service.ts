import {
  Injectable,
  Logger,
  BadRequestException,
  BadGatewayException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PaymentProviderService } from '../payments/payment-provider.service';

type ReconciliationItemType = 'MATCHED' | 'AMOUNT_MISMATCH' | 'MISSING_INTERNAL' | 'MISSING_STRIPE';

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
    if (!(params.periodStart instanceof Date) || Number.isNaN(params.periodStart.getTime())) {
      throw new BadRequestException('Invalid periodStart');
    }
    if (!(params.periodEnd instanceof Date) || Number.isNaN(params.periodEnd.getTime())) {
      throw new BadRequestException('Invalid periodEnd');
    }
    if (params.periodStart >= params.periodEnd) {
      throw new BadRequestException('periodStart must be before periodEnd');
    }

    let run: { id: string };
    try {
      run = await this.prisma.reconciliationRun.create({
        data: {
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
          startedById: params.startedById || null,
          status: 'RUNNING',
        },
      });
    } catch (err: any) {
      this.logger.error(`Failed to create reconciliation run: ${err?.message}`, err?.stack);
      if (err?.code === 'P2003' || err?.message?.includes('Foreign key')) {
        throw new BadRequestException('Invalid startedBy user for reconciliation run');
      }
      // Raw Prisma/Postgres errors must not reach the admin UI.
      throw new InternalServerErrorException(
        'Could not start reconciliation. The reconciliation storage is unavailable — please contact support if this persists.',
      );
    }

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
      const internalByStripeId = new Map<string, (typeof internalTransactions)[0]>();
      for (const tx of internalTransactions) {
        const stripeId =
          tx.order?.stripePaymentIntentId ||
          (typeof tx.metadata === 'object' && tx.metadata
            ? (tx.metadata as any).stripePaymentId || (tx.metadata as any).stripePaymentIntentId
            : null);
        if (stripeId && typeof stripeId === 'string') {
          internalByStripeId.set(stripeId, tx);
        }
      }

      // Get Stripe payments for the period (if provider available)
      let stripeCharges: Array<{
        id: string;
        amount: number;
        currency: string;
        payment_intent: string | null;
      }> = [];
      let stripeFetchFailed = false;
      let stripeFetchError: string | undefined;

      if (this.paymentProviderService.isProviderAvailable('stripe')) {
        try {
          const stripe = this.paymentProviderService.getProvider('stripe');
          const stripeInstance = (stripe as any).getStripeInstance?.();
          if (!stripeInstance) {
            stripeFetchFailed = true;
            stripeFetchError = 'Stripe provider is configured but the Stripe SDK instance is unavailable';
          } else {
            const periodStart = Math.floor(params.periodStart.getTime() / 1000);
            const periodEnd = Math.floor(params.periodEnd.getTime() / 1000);
            let startingAfter: string | undefined;
            let hasMore = true;
            while (hasMore) {
              const charges = await stripeInstance.charges.list({
                created: { gte: periodStart, lt: periodEnd },
                limit: 100,
                ...(startingAfter ? { starting_after: startingAfter } : {}),
              });
              stripeCharges.push(
                ...charges.data.map((c: any) => ({
                  id: String(c.id),
                  amount: Number(c.amount) / 100,
                  currency: String(c.currency || 'usd').toUpperCase(),
                  payment_intent:
                    typeof c.payment_intent === 'string'
                      ? c.payment_intent
                      : c.payment_intent?.id
                        ? String(c.payment_intent.id)
                        : null,
                })),
              );
              hasMore = Boolean(charges.has_more);
              if (charges.data.length > 0) {
                startingAfter = charges.data[charges.data.length - 1].id;
              } else {
                hasMore = false;
              }
            }
          }
        } catch (err: any) {
          stripeFetchFailed = true;
          stripeFetchError = err?.message || 'Failed to fetch Stripe charges';
          this.logger.warn(`Could not fetch Stripe charges: ${stripeFetchError}`);
        }
      }

      // If Stripe was expected but failed and we have nothing to compare, fail the run clearly
      if (
        stripeFetchFailed &&
        stripeCharges.length === 0 &&
        internalTransactions.length === 0
      ) {
        throw new BadGatewayException(
          `Unable to reach Stripe for reconciliation: ${stripeFetchError || 'unknown error'}`,
        );
      }

      let matched = 0,
        mismatched = 0,
        missingInternal = 0,
        missingStripe = 0;
      const stripeProcessed = new Set<string>();
      const items: Array<{
        runId: string;
        type: ReconciliationItemType;
        transactionId?: string | null;
        stripeChargeId?: string | null;
        internalAmount?: number | null;
        stripeAmount?: number | null;
        currency?: string | null;
        discrepancyAmount?: number | null;
      }> = [];

      // Match Stripe charges against internal transactions
      for (const charge of stripeCharges) {
        const pi = charge.payment_intent;
        if (pi) stripeProcessed.add(pi);
        const internal = pi ? internalByStripeId.get(pi) : undefined;

        if (!internal) {
          missingInternal++;
          items.push({
            runId: run.id,
            type: 'MISSING_INTERNAL',
            stripeChargeId: charge.id,
            stripeAmount: this.toMoney(charge.amount),
            currency: charge.currency,
          });
        } else {
          const internalAmt = this.toMoney(Number(internal.amount));
          const internalCurrency = String(internal.currency || 'USD').toUpperCase();
          const stripeAmt = this.toMoney(charge.amount);
          const diff = Math.abs(internalAmt - stripeAmt);
          if (diff < 0.02 && internalCurrency === charge.currency) {
            matched++;
            items.push({
              runId: run.id,
              type: 'MATCHED',
              transactionId: internal.id,
              stripeChargeId: charge.id,
              internalAmount: internalAmt,
              stripeAmount: stripeAmt,
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
              stripeAmount: stripeAmt,
              currency: charge.currency,
              discrepancyAmount: this.toMoney(internalAmt - stripeAmt),
            });
          }
        }
      }

      // Find internal PAYMENT transactions with no Stripe match
      for (const [stripeId, txRow] of internalByStripeId.entries()) {
        if (!stripeProcessed.has(stripeId)) {
          missingStripe++;
          items.push({
            runId: run.id,
            type: 'MISSING_STRIPE',
            transactionId: txRow.id,
            internalAmount: this.toMoney(Number(txRow.amount)),
            currency: String(txRow.currency || 'USD').toUpperCase(),
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
            type: 'MATCHED',
            transactionId: refundTx.id,
            internalAmount: this.toMoney(actual),
            currency: String(refundTx.currency || 'USD').toUpperCase(),
          });
        } else {
          mismatched++;
          items.push({
            runId: run.id,
            type: 'AMOUNT_MISMATCH',
            transactionId: refundTx.id,
            internalAmount: this.toMoney(actual),
            stripeAmount: this.toMoney(expected),
            currency: String(refundTx.currency || 'USD').toUpperCase(),
            discrepancyAmount: this.toMoney(actual - expected),
          });
        }
      }

      // When Stripe is unavailable, record internal-only summary so runs aren't empty
      if (stripeCharges.length === 0 && internalTransactions.length > 0) {
        for (const txRow of internalTransactions) {
          if (!items.some((i) => i.transactionId === txRow.id)) {
            missingStripe++;
            items.push({
              runId: run.id,
              type: 'MISSING_STRIPE',
              transactionId: txRow.id,
              internalAmount: this.toMoney(Number(txRow.amount)),
              currency: String(txRow.currency || 'USD').toUpperCase(),
            });
          }
        }
        if (stripeFetchFailed) {
          this.logger.warn(
            `Reconciliation ${run.id} completed with internal-only items (Stripe unavailable: ${stripeFetchError})`,
          );
        }
      }

      // Batch create items — coerce to Prisma-safe scalars
      if (items.length > 0) {
        const data: Prisma.ReconciliationItemCreateManyInput[] = items.map((item) => ({
          runId: item.runId,
          type: item.type,
          transactionId: item.transactionId ?? null,
          stripeChargeId: item.stripeChargeId ?? null,
          internalAmount:
            item.internalAmount == null ? null : new Prisma.Decimal(item.internalAmount),
          stripeAmount: item.stripeAmount == null ? null : new Prisma.Decimal(item.stripeAmount),
          currency: item.currency ?? null,
          discrepancyAmount:
            item.discrepancyAmount == null ? null : new Prisma.Decimal(item.discrepancyAmount),
        }));

        try {
          await this.prisma.reconciliationItem.createMany({ data });
        } catch (createErr: any) {
          this.logger.error(
            `reconciliationItem.createMany failed: ${createErr?.message}`,
            createErr?.stack,
          );
          throw new BadRequestException(
            `Failed to save reconciliation items: ${createErr?.message || 'invalid item data'}`,
          );
        }
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
          notes: stripeFetchFailed
            ? `Completed with Stripe fetch warning: ${stripeFetchError}`
            : undefined,
        },
        include: { items: true },
      });

      this.logger.log(
        `Reconciliation complete: ${matched} matched, ${mismatched} mismatched, ${missingInternal} missing internal, ${missingStripe} missing in Stripe`,
      );
      return updated;
    } catch (err: any) {
      const errorMessage = err?.message || 'Unknown error occurred';
      try {
        await this.prisma.reconciliationRun.update({
          where: { id: run.id },
          data: { status: 'FAILED', notes: errorMessage },
        });
      } catch (updateErr: any) {
        this.logger.error(`Failed to mark reconciliation run FAILED: ${updateErr?.message}`);
      }
      this.logger.error(`Reconciliation failed: ${errorMessage}`, err?.stack);

      if (
        err instanceof BadRequestException ||
        err instanceof BadGatewayException ||
        err instanceof InternalServerErrorException
      ) {
        throw err;
      }

      // Upstream / network style failures → 502; validation-ish → 400
      const msg = String(errorMessage).toLowerCase();
      if (
        msg.includes('stripe') ||
        msg.includes('econn') ||
        msg.includes('timeout') ||
        msg.includes('network') ||
        msg.includes('503') ||
        msg.includes('502')
      ) {
        throw new BadGatewayException(`Reconciliation failed: ${errorMessage}`);
      }
      throw new BadRequestException(`Reconciliation failed: ${errorMessage}`);
    }
  }

  private toMoney(n: number): number {
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 100) / 100;
  }

  async getRuns(filters?: { status?: string; page?: number; limit?: number }) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const where: any = {};
    if (filters?.status) {
      const status = filters.status.trim().toUpperCase();
      if (!['RUNNING', 'COMPLETED', 'FAILED'].includes(status)) {
        throw new BadRequestException(
          `Invalid reconciliation status "${filters.status}". Expected one of: RUNNING, COMPLETED, FAILED`,
        );
      }
      where.status = status;
    }

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
    try {
      return await this.prisma.reconciliationItem.update({
        where: { id: itemId },
        data: {
          status: 'RESOLVED',
          resolvedById,
          resolvedAt: new Date(),
          resolution,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Reconciliation item not found');
      }
      throw err;
    }
  }

  async ignoreItem(itemId: string, resolvedById: string, reason: string) {
    try {
      return await this.prisma.reconciliationItem.update({
        where: { id: itemId },
        data: {
          status: 'IGNORED',
          resolvedById,
          resolvedAt: new Date(),
          resolution: reason,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Reconciliation item not found');
      }
      throw err;
    }
  }
}
