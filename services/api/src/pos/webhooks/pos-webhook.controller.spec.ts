import * as crypto from 'crypto';
import { PosWebhookController } from './pos-webhook.controller';
import { BadRequestException } from '@nestjs/common';
import { JobType } from '../../queue/queue.service';

function makeMocks() {
  const prisma: any = {
    store: { findUnique: jest.fn() },
    pOSConnection: { findFirst: jest.fn() },
  };
  const validateWebhook = jest.fn().mockReturnValue(true);
  const parseWebhookSale = jest.fn().mockReturnValue({
    externalId: 's1',
    items: [],
    totalAmount: 0,
    currency: 'USD',
    taxAmount: 0,
    discountAmount: 0,
    saleDate: new Date(),
    rawPayload: {},
  });
  const factory: any = {
    create: jest.fn().mockReturnValue({
      validateWebhook,
      parseWebhookSale,
    }),
  };
  const queue: any = {
    addJob: jest.fn().mockResolvedValue('job-1'),
  };
  const config: any = {
    get: jest.fn().mockReturnValue('true'),
  };
  const encryption: any = {
    decryptJson: jest.fn().mockReturnValue({ clientSecret: 'oauth-client-secret' }),
  };
  const featureFlags: any = {
    isEnabled: jest.fn().mockReturnValue(true),
  };

  const controller = new PosWebhookController(
    prisma,
    factory,
    queue,
    config,
    encryption,
    featureFlags,
  );
  return {
    controller,
    prisma,
    factory,
    queue,
    config,
    encryption,
    featureFlags,
    validateWebhook,
    parseWebhookSale,
  };
}

function rawReq(raw: string): any {
  return { rawBody: Buffer.from(raw, 'utf8'), headers: {} };
}

describe('PosWebhookController', () => {
  describe('handleWebhook', () => {
    it('rejects when POS is disabled', async () => {
      const { controller, config } = makeMocks();
      config.get.mockReturnValue('false');
      await expect(
        controller.handleWebhook('lightspeed', 'STORE-1', {}, undefined, undefined, rawReq('')),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when FeatureFlag.POS_INTEGRATION is off', async () => {
      const { controller, featureFlags } = makeMocks();
      featureFlags.isEnabled.mockReturnValue(false);
      await expect(
        controller.handleWebhook('lightspeed', 'STORE-1', {}, undefined, undefined, rawReq('')),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unknown store', async () => {
      const { controller, prisma } = makeMocks();
      prisma.store.findUnique.mockResolvedValue(null);
      await expect(
        controller.handleWebhook('lightspeed', 'MISSING', {}, undefined, undefined, rawReq('x')),
      ).rejects.toThrow('Unknown store');
    });

    it('rejects when no webhook secret or client secret configured', async () => {
      const { controller, prisma, encryption } = makeMocks();
      prisma.store.findUnique.mockResolvedValue({ id: 's1' });
      prisma.pOSConnection.findFirst.mockResolvedValue({
        provider: 'lightspeed',
        credentials: 'enc',
        webhookSecret: null,
      });
      encryption.decryptJson.mockReturnValue({});
      await expect(
        controller.handleWebhook('lightspeed', 'STORE-1', {}, undefined, undefined, rawReq('x')),
      ).rejects.toThrow('Webhook not configured');
    });

    it('rejects invalid signature', async () => {
      const { controller, prisma, factory } = makeMocks();
      prisma.store.findUnique.mockResolvedValue({ id: 's1' });
      prisma.pOSConnection.findFirst.mockResolvedValue({
        provider: 'lightspeed',
        credentials: 'enc',
        webhookSecret: 'secret',
      });
      factory.create.mockReturnValue({
        validateWebhook: jest.fn().mockReturnValue(false),
        parseWebhookSale: jest.fn(),
      });
      await expect(
        controller.handleWebhook(
          'lightspeed',
          'STORE-1',
          {},
          'signature=bad,algorithm=HMAC-SHA256',
          undefined,
          rawReq('payload=%7B%7D'),
        ),
      ).rejects.toThrow('Invalid signature');
    });

    it('validates signature against raw body and client_secret', async () => {
      const { controller, prisma, validateWebhook, encryption } = makeMocks();
      const raw = 'payload=%7B%22id%22%3A%221%22%7D&type=sale.update';
      prisma.store.findUnique.mockResolvedValue({ id: 's1' });
      prisma.pOSConnection.findFirst.mockResolvedValue({
        provider: 'lightspeed',
        credentials: 'enc',
        webhookSecret: 'fallback-secret',
      });
      encryption.decryptJson.mockReturnValue({ clientSecret: 'oauth-client-secret' });

      const hex = crypto
        .createHmac('sha256', 'oauth-client-secret')
        .update(raw)
        .digest('hex');
      const header = `signature=${hex},algorithm=HMAC-SHA256`;

      await controller.handleWebhook(
        'lightspeed',
        'STORE-1',
        { type: 'sale.update', payload: '{"id":"1","register_sale_products":[]}' },
        header,
        undefined,
        rawReq(raw),
      );

      expect(validateWebhook).toHaveBeenCalledWith(raw, header, 'oauth-client-secret');
    });

    it('ignores non-sale events without enqueueing', async () => {
      const { controller, prisma, queue, parseWebhookSale } = makeMocks();
      prisma.store.findUnique.mockResolvedValue({ id: 's1' });
      prisma.pOSConnection.findFirst.mockResolvedValue({
        provider: 'lightspeed',
        credentials: 'enc',
        webhookSecret: 'secret',
      });

      const result = await controller.handleWebhook(
        'lightspeed',
        'STORE-1',
        { type: 'product.update', payload: '{"id":"p1"}' },
        'sig',
        undefined,
        rawReq('payload=%7B%22id%22%3A%22p1%22%7D&type=product.update'),
      );

      expect(result).toEqual({ ok: true });
      expect(queue.addJob).not.toHaveBeenCalled();
      expect(parseWebhookSale).not.toHaveBeenCalled();
    });

    it('enqueues BullMQ job on valid sale webhook', async () => {
      const { controller, prisma, queue } = makeMocks();
      prisma.store.findUnique.mockResolvedValue({ id: 's1' });
      prisma.pOSConnection.findFirst.mockResolvedValue({
        provider: 'lightspeed',
        credentials: 'enc',
        webhookSecret: 'secret',
      });

      const result = await controller.handleWebhook(
        'lightspeed',
        'STORE-1',
        {
          type: 'sale.update',
          payload: JSON.stringify({
            id: '123',
            register_sale_products: [{ product_id: 'p1', quantity: 1 }],
          }),
        },
        'valid-sig',
        undefined,
        rawReq('type=sale.update&payload=%7B%7D'),
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
        credentials: 'enc',
        webhookSecret: 'secret',
      });

      const result = await controller.handleWebhook(
        'lightspeed',
        'STORE-1',
        {
          type: 'sale.update',
          payload: '{"id":"1","line_items":[]}',
        },
        undefined,
        'alt-sig',
        rawReq('type=sale.update'),
      );

      expect(result).toEqual({ ok: true });
      expect(queue.addJob).toHaveBeenCalled();
    });

    it('falls back to webhookSecret when client_secret missing', async () => {
      const { controller, prisma, encryption, validateWebhook } = makeMocks();
      prisma.store.findUnique.mockResolvedValue({ id: 's1' });
      prisma.pOSConnection.findFirst.mockResolvedValue({
        provider: 'lightspeed',
        credentials: 'enc',
        webhookSecret: 'manual-hook-secret',
      });
      encryption.decryptJson.mockReturnValue({});

      await controller.handleWebhook(
        'lightspeed',
        'STORE-1',
        { type: 'sale.update', payload: '{"id":"1","line_items":[]}' },
        'sig',
        undefined,
        rawReq('body'),
      );

      expect(validateWebhook).toHaveBeenCalledWith('body', 'sig', 'manual-hook-secret');
    });
  });
});
