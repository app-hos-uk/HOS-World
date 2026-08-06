import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { isTruthy } from '../../common/utils/config';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { DiscrepanciesService } from '../../discrepancies/discrepancies.service';
import { EncryptionService } from '../../integrations/encryption.service';
import type { POSAdapter } from '../interfaces/pos-adapter.interface';
import type { POSGiftCard } from '../interfaces/pos-types';
import { POSAdapterFactory } from '../pos-adapter.factory';
import { isPosRuntimeEnabled } from '../pos-enabled';

export type GiftCardReconSummary = {
  connectionsChecked: number;
  cardsChecked: number;
  vouchersChecked: number;
  discrepancies: number;
  errors: number;
};

type IssuedVoucher = {
  id: string;
  clientId: string;
  cardNumber: string;
  amount: { toString(): string } | number;
  status: string;
  storeId: string;
};

@Injectable()
export class PosGiftCardReconService {
  private readonly logger = new Logger(PosGiftCardReconService.name);

  constructor(
    private prisma: PrismaService,
    private discrepancies: DiscrepanciesService,
    private factory: POSAdapterFactory,
    private encryption: EncryptionService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
  ) {}

  /**
   * Poll Lightspeed gift cards and record balance/status drift vs LoyaltyPosVoucher.
   * Never auto-corrects balances — discrepancies are for human review only.
   */
  async reconcile(): Promise<GiftCardReconSummary> {
    const empty: GiftCardReconSummary = {
      connectionsChecked: 0,
      cardsChecked: 0,
      vouchersChecked: 0,
      discrepancies: 0,
      errors: 0,
    };

    if (!isPosRuntimeEnabled(this.config, this.featureFlags)) {
      this.logger.log('Gift card recon skipped (POS runtime disabled)');
      return empty;
    }
    if (!isTruthy(this.config.get<string>('LOYALTY_POS_VOUCHER_ENABLED'))) {
      this.logger.log('Gift card recon skipped (LOYALTY_POS_VOUCHER_ENABLED != true)');
      return empty;
    }

    const vouchers = (await this.prisma.loyaltyPosVoucher.findMany({
      where: { status: 'ISSUED' },
      select: {
        id: true,
        clientId: true,
        cardNumber: true,
        amount: true,
        status: true,
        storeId: true,
      },
    })) as IssuedVoucher[];

    const byClientId = new Map(vouchers.map((v) => [v.clientId, v]));
    const byCardNumber = new Map(vouchers.map((v) => [v.cardNumber, v]));
    const matchedVoucherIds = new Set<string>();
    const reportedOrphanCardIds = new Set<string>();
    const polledStoreIds = new Set<string>();

    const connections = await this.prisma.pOSConnection.findMany({
      where: { isActive: true },
      include: { store: { select: { id: true, code: true } } },
    });

    let cardsChecked = 0;
    let discrepancies = 0;
    let errors = 0;
    let connectionsChecked = 0;

    for (const conn of connections) {
      let adapter: POSAdapter;
      try {
        const creds = this.encryption.decryptJson<Record<string, unknown>>(conn.credentials);
        adapter = this.factory.create(conn.provider, conn.credentials);
        await adapter.authenticate(creds);
      } catch (e) {
        errors++;
        this.logger.warn(
          `Gift card recon auth failed for store ${conn.storeId}: ${(e as Error).message}`,
        );
        continue;
      }

      if (typeof adapter.listGiftCards !== 'function') {
        this.logger.warn(
          `Gift card recon skipped for ${conn.provider}: listGiftCards not supported`,
        );
        continue;
      }

      let cards: POSGiftCard[];
      try {
        cards = await adapter.listGiftCards();
      } catch (e) {
        errors++;
        this.logger.warn(
          `Gift card list failed for store ${conn.storeId}: ${(e as Error).message}`,
        );
        continue;
      }

      connectionsChecked++;
      polledStoreIds.add(conn.storeId);

      for (const card of cards) {
        cardsChecked++;
        try {
          const clientIds = this.clientIdsFromCard(card);
          let voucher: IssuedVoucher | undefined;
          for (const cid of clientIds) {
            voucher = byClientId.get(cid);
            if (voucher) break;
          }
          // Activation-only create leaves client_id null — fall back to card number.
          if (!voucher && card.number) {
            voucher = byCardNumber.get(card.number);
          }

          if (voucher) {
            matchedVoucherIds.add(voucher.id);
            const drift = await this.recordVoucherDrift(voucher, card, conn.store.code);
            if (drift) discrepancies++;
            continue;
          }

          // Orphan: API-issued card (has client_id) with no LoyaltyPosVoucher match.
          if (clientIds.length > 0) {
            const orphanKey = card.id || card.number;
            if (orphanKey && reportedOrphanCardIds.has(orphanKey)) continue;
            if (orphanKey) reportedOrphanCardIds.add(orphanKey);
            await this.discrepancies.createDiscrepancy({
              type: 'SETTLEMENT',
              severity: 'MEDIUM',
              description: `Lightspeed gift card with no matching LoyaltyPosVoucher (store ${conn.store.code})`,
              expectedValue: {
                source: 'HOS',
                kind: 'loyalty_pos_voucher',
                clientIds,
              },
              actualValue: {
                source: 'POS',
                giftCardId: card.id,
                number: card.number,
                balance: card.balance,
                status: card.status ?? null,
                clientIds,
              },
            });
            discrepancies++;
          }
        } catch (e) {
          errors++;
          this.logger.warn(`Gift card recon row failed: ${(e as Error).message}`);
        }
      }
    }

    for (const voucher of vouchers) {
      if (matchedVoucherIds.has(voucher.id)) continue;
      // Only flag missing cards for stores we successfully polled.
      if (!polledStoreIds.has(voucher.storeId)) continue;
      try {
        await this.discrepancies.createDiscrepancy({
          type: 'SETTLEMENT',
          severity: 'HIGH',
          description: `ISSUED LoyaltyPosVoucher has no matching Lightspeed gift card (clientId=${voucher.clientId})`,
          expectedValue: {
            source: 'HOS',
            voucherId: voucher.id,
            clientId: voucher.clientId,
            cardNumber: voucher.cardNumber,
            amount: Number(voucher.amount),
            status: voucher.status,
          },
          actualValue: {
            source: 'POS',
            found: false,
          },
        });
        discrepancies++;
      } catch (e) {
        errors++;
        this.logger.warn(
          `Failed to record missing gift card for voucher ${voucher.id}: ${(e as Error).message}`,
        );
      }
    }

    const summary: GiftCardReconSummary = {
      connectionsChecked,
      cardsChecked,
      vouchersChecked: vouchers.length,
      discrepancies,
      errors,
    };
    this.logger.log(`Gift card recon complete: ${JSON.stringify(summary)}`);
    return summary;
  }

  private clientIdsFromCard(card: POSGiftCard): string[] {
    const ids = new Set<string>();
    for (const tx of card.transactions ?? []) {
      if (tx.clientId) ids.add(tx.clientId);
    }
    return [...ids];
  }

  private moneyEqual(a: number, b: number): boolean {
    return Math.round(a * 100) === Math.round(b * 100);
  }

  private async recordVoucherDrift(
    voucher: IssuedVoucher,
    card: POSGiftCard,
    storeCode: string,
  ): Promise<boolean> {
    const expectedAmount = Number(voucher.amount);
    const actualBalance = Number(card.balance);
    const actualStatus = (card.status ?? '').toUpperCase();
    const balanceDrift = !this.moneyEqual(expectedAmount, actualBalance);
    // ISSUED vouchers expect an ACTIVE Lightspeed card; voided/expired/redeemed is drift.
    const statusDrift = actualStatus !== '' && actualStatus !== 'ACTIVE';

    if (!balanceDrift && !statusDrift) return false;

    await this.discrepancies.createDiscrepancy({
      type: 'SETTLEMENT',
      severity: statusDrift ? 'HIGH' : 'MEDIUM',
      description: `LoyaltyPosVoucher vs Lightspeed gift card drift (store ${storeCode}, clientId=${voucher.clientId})`,
      expectedValue: {
        source: 'HOS',
        voucherId: voucher.id,
        clientId: voucher.clientId,
        cardNumber: voucher.cardNumber,
        amount: expectedAmount,
        status: voucher.status,
      },
      actualValue: {
        source: 'POS',
        giftCardId: card.id,
        number: card.number,
        balance: actualBalance,
        status: card.status ?? null,
        balanceDrift,
        statusDrift,
      },
    });
    return true;
  }
}
