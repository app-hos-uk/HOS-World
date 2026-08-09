import {
  Body,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  BadRequestException,
  type RawBodyRequest,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { EncryptionService } from '../../integrations/encryption.service';
import { POSAdapterFactory } from '../pos-adapter.factory';
import { QueueService, JobType } from '../../queue/queue.service';
import { isPosRuntimeEnabled } from '../pos-enabled';

@ApiTags('pos-webhooks')
@Controller('pos/webhooks')
export class PosWebhookController {
  constructor(
    private prisma: PrismaService,
    private factory: POSAdapterFactory,
    private queue: QueueService,
    private config: ConfigService,
    private encryption: EncryptionService,
    private featureFlags: FeatureFlagsService,
  ) {}

  @Public()
  @Post(':provider/:storeCode')
  async handleWebhook(
    @Param('provider') provider: string,
    @Param('storeCode') storeCode: string,
    @Body() body: unknown,
    @Headers('x-webhook-signature') sigHeader: string | undefined,
    @Headers('x-signature') sigAlt: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ ok: boolean }> {
    if (!isPosRuntimeEnabled(this.config, this.featureFlags)) {
      throw new BadRequestException('POS is not enabled');
    }

    const store = await this.prisma.store.findUnique({
      where: { code: storeCode },
    });
    if (!store) {
      throw new BadRequestException('Unknown store');
    }

    const connection = await this.prisma.pOSConnection.findFirst({
      where: {
        storeId: store.id,
        provider: { equals: provider, mode: 'insensitive' },
        isActive: true,
      },
    });
    if (!connection) {
      throw new BadRequestException('Webhook not configured');
    }

    let clientSecret: string | undefined;
    try {
      const creds = this.encryption.decryptJson<Record<string, unknown>>(connection.credentials);
      const raw = creds.clientSecret ?? creds.client_secret;
      if (raw) clientSecret = String(raw);
    } catch {
      // fall back to webhookSecret
    }

    const secret = clientSecret || connection.webhookSecret || '';
    if (!secret) {
      throw new BadRequestException('Webhook not configured');
    }

    const adapter = this.factory.create(connection.provider, connection.credentials);
    const signature = sigHeader || sigAlt || String(req.headers['x-webhook-signature'] ?? '');
    const rawBody = this.getRawBody(req);
    if (!adapter.validateWebhook(rawBody, signature, secret)) {
      throw new BadRequestException('Invalid signature');
    }

    if (!this.isSaleWebhook(body)) {
      return { ok: true };
    }

    const parsed = adapter.parseWebhookSale(body);

    await this.queue.addJob(JobType.POS_SALE_IMPORT, {
      storeId: store.id,
      provider: connection.provider,
      parsed,
    });

    return { ok: true };
  }

  private getRawBody(req: RawBodyRequest<Request>): string {
    const raw = req.rawBody;
    if (Buffer.isBuffer(raw)) return raw.toString('utf8');
    if (typeof raw === 'string') return raw;
    throw new BadRequestException('Missing raw body');
  }

  /** Sale events only — ignore product/inventory/customer updates. */
  private isSaleWebhook(body: unknown): boolean {
    const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const type = String(b.type ?? b.topic ?? '').toLowerCase();

    if (type) {
      if (type === 'sale.delete' || type.endsWith('.delete')) return false;
      if (type === 'sale.update' || type.startsWith('sale.') || type.includes('register_sale')) {
        return true;
      }
      return false;
    }

    let saleObj: Record<string, unknown> | null = null;
    if (typeof b.payload === 'string') {
      try {
        saleObj = JSON.parse(b.payload) as Record<string, unknown>;
      } catch {
        return false;
      }
    } else if (b.payload && typeof b.payload === 'object') {
      saleObj = b.payload as Record<string, unknown>;
    } else if (b.id != null) {
      saleObj = b;
    }

    if (!saleObj?.id) return false;
    return Array.isArray(saleObj.register_sale_products) || Array.isArray(saleObj.line_items);
  }
}
