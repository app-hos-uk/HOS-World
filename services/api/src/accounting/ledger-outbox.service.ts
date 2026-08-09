import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { XeroApiClient } from './xero-api.client';
import { XeroAuthService } from './xero-auth.service';
import { assertNoPosSaleInLedger } from './pos-sale.guard';
import {
  ALLOWED_LEDGER_ENTRY_TYPES,
  LedgerOutboxStatus,
  type XeroManualJournalPayload,
} from './accounting.types';

const MAX_ATTEMPTS_BEFORE_DEAD = 8;
const POSTING_STALE_MS = 5 * 60 * 1000; // 5 minutes — rows stuck in POSTING longer than this are reclaimed

@Injectable()
export class LedgerOutboxService {
  private readonly logger = new Logger(LedgerOutboxService.name);

  constructor(
    private prisma: PrismaService,
    private xeroApi: XeroApiClient,
    private xeroAuth: XeroAuthService,
  ) {}

  /**
   * Upsert a ledger outbox row by idempotencyKey.
   * POSTED/POSTING rows are left unchanged (idempotent re-enqueue).
   */
  async enqueue(
    entryType: string,
    periodDate: Date | string,
    idempotencyKey: string,
    payload: unknown,
  ) {
    if (!ALLOWED_LEDGER_ENTRY_TYPES.has(entryType)) {
      throw new BadRequestException(`Unsupported ledger entryType: ${entryType}`);
    }
    assertNoPosSaleInLedger(entryType, payload);

    const period =
      typeof periodDate === 'string'
        ? new Date(`${periodDate.slice(0, 10)}T00:00:00.000Z`)
        : periodDate;

    const existing = await this.prisma.ledgerOutboxEntry.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      if (
        existing.status === LedgerOutboxStatus.POSTED ||
        existing.status === LedgerOutboxStatus.POSTING
      ) {
        return existing;
      }
      return this.prisma.ledgerOutboxEntry.update({
        where: { idempotencyKey },
        data: {
          entryType,
          periodDate: period,
          payload: payload as Prisma.InputJsonValue,
          status: LedgerOutboxStatus.PENDING,
          lastError: null,
        },
      });
    }

    return this.prisma.ledgerOutboxEntry.create({
      data: {
        entryType,
        periodDate: period,
        idempotencyKey,
        payload: payload as Prisma.InputJsonValue,
        status: LedgerOutboxStatus.PENDING,
      },
    });
  }

  async list(params: { status?: string; entryType?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 50));
    const where: Prisma.LedgerOutboxEntryWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.entryType) where.entryType = params.entryType;

    const [items, total] = await Promise.all([
      this.prisma.ledgerOutboxEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ledgerOutboxEntry.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async retryFailed(id: string) {
    const row = await this.prisma.ledgerOutboxEntry.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Outbox entry not found');
    if (row.status !== LedgerOutboxStatus.FAILED && row.status !== LedgerOutboxStatus.DEAD) {
      throw new BadRequestException(`Cannot retry entry in status ${row.status}`);
    }

    assertNoPosSaleInLedger(row.entryType, row.payload);

    return this.prisma.ledgerOutboxEntry.update({
      where: { id },
      data: {
        status: LedgerOutboxStatus.PENDING,
        lastError: null,
      },
    });
  }

  /**
   * Drain PENDING rows → POST ManualJournals with Idempotency-Key.
   * Also reclaims rows stuck in POSTING (worker crash / timeout) before processing.
   * Handles 429 Retry-After inside XeroApiClient.
   */
  async drainPending(
    batchSize = 20,
  ): Promise<{ processed: number; posted: number; failed: number }> {
    await this.reclaimStalePosting();

    const pending = await this.prisma.ledgerOutboxEntry.findMany({
      where: { status: LedgerOutboxStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });

    let posted = 0;
    let failed = 0;

    for (const row of pending) {
      const claimed = await this.prisma.ledgerOutboxEntry.updateMany({
        where: { id: row.id, status: LedgerOutboxStatus.PENDING },
        data: {
          status: LedgerOutboxStatus.POSTING,
          attempts: { increment: 1 },
        },
      });
      if (claimed.count === 0) continue;

      try {
        assertNoPosSaleInLedger(row.entryType, row.payload);

        const { accessToken, tenantId } = await this.xeroAuth.getValidAccessToken();
        const journal = row.payload as unknown as XeroManualJournalPayload;
        const { manualJournalId } = await this.xeroApi.postManualJournal(
          accessToken,
          tenantId,
          journal,
          row.idempotencyKey,
        );

        await this.prisma.ledgerOutboxEntry.update({
          where: { id: row.id },
          data: {
            status: LedgerOutboxStatus.POSTED,
            xeroJournalId: manualJournalId,
            postedAt: new Date(),
            lastError: null,
          },
        });
        posted++;
      } catch (e) {
        const message = (e as Error).message?.slice(0, 2000) || 'Unknown error';
        const attempts = row.attempts + 1;
        const status =
          attempts >= MAX_ATTEMPTS_BEFORE_DEAD
            ? LedgerOutboxStatus.DEAD
            : LedgerOutboxStatus.FAILED;

        await this.prisma.ledgerOutboxEntry.update({
          where: { id: row.id },
          data: { status, lastError: message },
        });
        failed++;
        this.logger.warn(`Ledger outbox ${row.id} → ${status}: ${message}`);
      }
    }

    return { processed: pending.length, posted, failed };
  }

  /**
   * Reset rows stuck in POSTING longer than POSTING_STALE_MS back to PENDING.
   * Xero's Idempotency-Key on the ManualJournal POST ensures a re-post
   * is safe even if the original request actually succeeded.
   */
  private async reclaimStalePosting(): Promise<number> {
    const cutoff = new Date(Date.now() - POSTING_STALE_MS);
    const { count } = await this.prisma.ledgerOutboxEntry.updateMany({
      where: {
        status: LedgerOutboxStatus.POSTING,
        updatedAt: { lt: cutoff },
      },
      data: { status: LedgerOutboxStatus.PENDING },
    });
    if (count > 0) {
      this.logger.warn(`Reclaimed ${count} stale POSTING outbox rows back to PENDING`);
    }
    return count;
  }
}
