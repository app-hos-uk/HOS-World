import { Injectable, Logger } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma.service';
import { EncryptionService } from '../../integrations/encryption.service';
import type { POSAdapter } from '../../pos/interfaces/pos-adapter.interface';
import { POSAdapterFactory } from '../../pos/pos-adapter.factory';

/**
 * Bridge LoyaltyPosVoucher rows to HOS GiftCard pointers (Lightspeed EXTERNAL ledger).
 */
@Injectable()
export class PosExternalGiftCardService {
  private readonly logger = new Logger(PosExternalGiftCardService.name);

  constructor(
    private prisma: PrismaService,
    private factory: POSAdapterFactory,
    private encryption: EncryptionService,
  ) {}

  /** Create or refresh the HOS GiftCard pointer after voucher issuance. */
  async ensurePointerForVoucher(voucherId: string): Promise<void> {
    const voucher = await this.prisma.loyaltyPosVoucher.findUnique({
      where: { id: voucherId },
      include: {
        membership: { select: { userId: true } },
        giftCard: { select: { id: true } },
      },
    });
    if (!voucher || voucher.status !== 'ISSUED') return;
    if (voucher.giftCard) return;

    const userId = voucher.membership.userId;
    const amount = Number(voucher.amount);

    await this.prisma.giftCard.create({
      data: {
        code: voucher.cardNumber,
        userId,
        type: 'digital',
        amount: new Decimal(amount.toFixed(2)),
        balance: new Decimal(amount.toFixed(2)),
        currency: voucher.currency,
        status: 'ACTIVE',
        source: 'POS_VOUCHER',
        balanceSource: 'EXTERNAL',
        posVoucherId: voucher.id,
        externalClientId: voucher.clientId,
        externalTransactionId: voucher.externalTransactionId ?? undefined,
        expiresAt: voucher.ttlExpiresAt ?? voucher.expiresAt ?? undefined,
        message: 'Loyalty points redeemed in store',
      },
    });
  }

  async syncExternalBalance(code: string, adapter: POSAdapter): Promise<number | null> {
    try {
      const card = await adapter.getGiftCardByNumber(code);
      if (!card) return null;
      return Number(card.balance);
    } catch (e) {
      this.logger.warn(`Lightspeed balance read failed for ${code}: ${(e as Error).message}`);
      return null;
    }
  }

  async buildAdapterForStore(storeId: string): Promise<POSAdapter | null> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: { posConnection: true },
    });
    if (!store?.posConnection?.isActive || !store.posConnection.credentials) return null;
    const creds = this.encryption.decryptJson<Record<string, unknown>>(
      store.posConnection.credentials,
    );
    const adapter = this.factory.create(store.posConnection.provider, store.posConnection.credentials);
    await adapter.authenticate(creds);
    return adapter;
  }

  async markPointerCancelled(voucherId: string): Promise<void> {
    await this.prisma.giftCard.updateMany({
      where: { posVoucherId: voucherId, status: 'ACTIVE' },
      data: { status: 'CANCELLED', balance: new Decimal(0) },
    });
  }
}
