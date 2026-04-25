import { PosWebhookController } from './pos-webhook.controller';
import { BadRequestException } from '@nestjs/common';
import { JobType } from '../../queue/queue.service';

function makeMocks() {
  const prisma: any = {
    store: { findUnique: jest.fn() },
    pOSConnection: { findFirst: jest.fn() },
  };
  const factory: any = {
    create: jest.fn().mockReturnValue({
      validateWebhook: jest.fn().mockReturnValue(true),
      parseWebhookSale: jest.fn().mockReturnValue({
        externalId: 's1',
        items: [],
        totalAmount: 0,
        currency: 'USD',
        taxAmount: 0,
        discountAmount: 0,
        saleDate: new Date(),
        rawPayload: {},
      }),
    }),
  };
  const queue: any = {
    addJob: jest.fn().mockResolvedValue('job-1'),
  };
  const config: any = {
    get: jest.fn().mockReturnValue('true'),
  };

  const controller = new PosWebhookController(prisma, factory, queue, config);
  return { controller, prisma, factory, queue, config };
}

describe('PosWebhookController', () => {
  describe('handleWebhook', () => {
    it('rejects when POS is disabled', async () => {
      const { controller, config } = makeMocks();
      config.get.mockReturnValue('false');
      await expect(
        controller.handleWebhook('lightspeed', 'STORE-1', {}, undefined, undefined, {} as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unknown store', async () => {
      const { controller, prisma } = makeMocks();
      prisma.store.findUnique.mockResolvedValue(null);
      await expect(
        controller.handleWebhook('lightspeed', 'MISSING', {}, undefined, undefined, {} as any),
      ).rejects.toThrow('Unknown store');
    });

    it('rejects when no webhook secret configured', async () => {
      const { controller, prisma } = makeMocks();
      prisma.store.findUnique.mockResolvedValue({ id: 's1' });
      prisma.pOSConnection.findFirst.mockResolvedValue({ webhookSecret: null });
      await expect(
        controller.handleWebhook('lightspeed', 'STORE-1', {}, undefined, undefined, {} as any),
      ).rejects.toThrow('Webhook not configured');
    });

    it('rejects invalid signature', async () => {
      const { controller, prisma, factory } = makeMocks();
      prisma.store.findUnique.mockResolvedValue({ id: 's1' });
      prisma.pOSConnection.findFirst.mockResolvedValue({
        provider: 'lightspeed',
        credentials: '{}',
        webhookSecret: 'secret',
      });
      factory.create.mockReturnValue({
        validateWebhook: jest.fn().mockReturnValue(false),
        parseWebhookSale: jest.fn(),
      });
      await expect(
        controller.handleWebhook('lightspeed', 'STORE-1', {}, 'bad-sig', undefined, {} as any),
      ).rejects.toThrow('Invalid signature');
    });

    it('enqueues BullMQ job on valid webhook', async () => {
      const { controller, prisma, queue } = makeMocks();
      prisma.store.findUnique.mockResolvedValue({ id: 's1' });
      prisma.pOSConnection.findFirst.mockResolvedValue({
        provider: 'lightspeed',
        credentials: '{}',
        webhookSecret: 'secret',
      });

      const result = await controller.handleWebhook(
        'lightspeed',
        'STORE-1',
        { sale_id: '123' },
        'valid-sig',
        undefined,
        {} as any,
      );

      expect(result).toEqual({ ok: true });
      expect(queue.addJob).toHaveBeenCalledWith(
        JobType.POS_SALE_IMPORT,
        expect.objectContaining({
          storeId: 's1',
          provider: 'lightspeed',
        }),
      );
    });

    it('accepts x-signature header as fallback', async () => {
      const { controller, prisma, queue } = makeMocks();
      prisma.store.findUnique.mockResolvedValue({ id: 's1' });
      prisma.pOSConnection.findFirst.mockResolvedValue({
        provider: 'lightspeed',
        credentials: '{}',
        webhookSecret: 'secret',
      });

      const result = await controller.handleWebhook(
        'lightspeed',
        'STORE-1',
        {},
        undefined,
        'alt-sig',
        {} as any,
      );

      expect(result).toEqual({ ok: true });
    });
  });
});
