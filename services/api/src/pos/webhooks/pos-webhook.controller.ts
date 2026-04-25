import { Body, Controller, Headers, Param, Post, Req, BadRequestException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaService } from '../../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { POSAdapterFactory } from '../pos-adapter.factory';
import { QueueService, JobType } from '../../queue/queue.service';

@ApiTags('pos-webhooks')
@Controller('pos/webhooks')
export class PosWebhookController {
  constructor(
    private prisma: PrismaService,
    private factory: POSAdapterFactory,
    private queue: QueueService,
    private config: ConfigService,
  ) {}

  @Public()
  @Post(':provider/:storeCode')
  async handleWebhook(
    @Param('provider') provider: string,
    @Param('storeCode') storeCode: string,
    @Body() body: unknown,
    @Headers('x-webhook-signature') sigHeader: string | undefined,
    @Headers('x-signature') sigAlt: string | undefined,
    @Req() _req: Request,
  ): Promise<{ ok: boolean }> {
    if (this.config.get<string>('POS_ENABLED') !== 'true') {
      throw new BadRequestException('POS is not enabled');
    }

    const store = await this.prisma.store.findUnique({
      where: { code: storeCode },
    });
    if (!store) {
      throw new BadRequestException('Unknown store');
    }

    const connection = await this.prisma.pOSConnection.findFirst({
      where: { storeId: store.id, provider: { equals: provider, mode: 'insensitive' }, isActive: true },
    });
    if (!connection?.webhookSecret) {
      throw new BadRequestException('Webhook not configured');
    }

    const adapter = this.factory.create(connection.provider, connection.credentials);
    const signature = sigHeader || sigAlt || '';
    if (!adapter.validateWebhook(body, signature, connection.webhookSecret)) {
      throw new BadRequestException('Invalid signature');
    }

    const parsed = adapter.parseWebhookSale(body);

    await this.queue.addJob(JobType.POS_SALE_IMPORT, {
      storeId: store.id,
      provider: connection.provider,
      parsed,
    });

    return { ok: true };
  }
}
