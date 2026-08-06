import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../integrations/encryption.service';
import { POSAdapterFactory } from './pos-adapter.factory';
import { CreatePosConnectionDto } from './dto/create-pos-connection.dto';
import { UpdatePosConnectionDto } from './dto/update-pos-connection.dto';
import { PosSalesFilterDto } from './dto/pos-sales-filter.dto';
import { PosProductSyncService } from './sync/product-sync.service';
import { PosInventorySyncService } from './sync/inventory-sync.service';
import { PosCustomerSyncService } from './sync/customer-sync.service';
import { PosCustomerIdentityBackfillService } from './sync/customer-identity-backfill.service';
import { PosSalesImportService } from './sync/sales-import.service';
import { QueueService, JobType } from '../queue/queue.service';
import { DiscrepanciesService } from '../discrepancies/discrepancies.service';

@ApiTags('admin-pos')
@ApiBearerAuth('JWT-auth')
@Controller('admin/pos')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class PosAdminController {
  constructor(
    private prisma: PrismaService,
    private encryption: EncryptionService,
    private factory: POSAdapterFactory,
    private productSync: PosProductSyncService,
    private inventorySync: PosInventorySyncService,
    private customerSync: PosCustomerSyncService,
    private customerIdentityBackfill: PosCustomerIdentityBackfillService,
    private salesImport: PosSalesImportService,
    private queue: QueueService,
    private discrepancies: DiscrepanciesService,
  ) {}

  /**
   * Strip encrypted credentials and webhook secrets from POS connection rows before returning
   * them to the client. Only presence flags are exposed.
   */
  private sanitizeConnection(conn: any): any {
    if (!conn || typeof conn !== 'object') return conn;
    const { credentials, webhookSecret, ...rest } = conn;
    return {
      ...rest,
      hasCredentials: !!credentials,
      hasWebhookSecret: !!webhookSecret,
    };
  }

  @Get('connections')
  async listConnections(): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.pOSConnection.findMany({
      include: { store: { select: { id: true, name: true, code: true, city: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return { data: data.map((c) => this.sanitizeConnection(c)), message: 'OK' };
  }

  @Post('connections')
  async create(@Body() dto: CreatePosConnectionDto): Promise<ApiResponse<unknown>> {
    const store = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
      include: { seller: true },
    });
    if (!store?.sellerId) {
      throw new BadRequestException('Store must have sellerId set for POS connection');
    }
    const enc = this.encryption.encrypt(JSON.stringify(dto.credentials));
    const data = await this.prisma.pOSConnection.create({
      data: {
        sellerId: store.sellerId,
        storeId: dto.storeId,
        provider: dto.provider.toLowerCase(),
        credentials: enc,
        externalOutletId: dto.externalOutletId,
        externalRegisterId: dto.externalRegisterId,
        webhookSecret: dto.webhookSecret,
        autoSyncProducts: dto.autoSyncProducts ?? true,
        autoSyncInventory: dto.autoSyncInventory ?? true,
        syncIntervalMinutes: dto.syncIntervalMinutes ?? 60,
      },
      include: { store: true },
    });
    return { data: this.sanitizeConnection(data), message: 'Created' };
  }

  @Put('connections/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePosConnectionDto,
  ): Promise<ApiResponse<unknown>> {
    const update: Record<string, unknown> = {};
    if (dto.credentials) {
      // Credentials are stored as a single encrypted blob, so a partial update must be
      // merged over the stored values — otherwise editing one field drops the rest.
      const existing = await this.prisma.pOSConnection.findUnique({
        where: { id },
        select: { credentials: true },
      });
      let current: Record<string, unknown> = {};
      if (existing?.credentials) {
        try {
          current = this.encryption.decryptJson<Record<string, unknown>>(existing.credentials);
        } catch {
          current = {};
        }
      }
      update.credentials = this.encryption.encrypt(
        JSON.stringify({ ...current, ...dto.credentials }),
      );
    }
    if (dto.externalOutletId !== undefined) update.externalOutletId = dto.externalOutletId;
    if (dto.externalRegisterId !== undefined) update.externalRegisterId = dto.externalRegisterId;
    if (dto.webhookSecret !== undefined) update.webhookSecret = dto.webhookSecret;
    if (dto.autoSyncProducts !== undefined) update.autoSyncProducts = dto.autoSyncProducts;
    if (dto.autoSyncInventory !== undefined) update.autoSyncInventory = dto.autoSyncInventory;
    if (dto.isActive !== undefined) update.isActive = dto.isActive;
    if (dto.syncIntervalMinutes !== undefined) update.syncIntervalMinutes = dto.syncIntervalMinutes;

    const data = await this.prisma.pOSConnection.update({
      where: { id },
      data: update as any,
      include: { store: true },
    });
    return { data: this.sanitizeConnection(data), message: 'Updated' };
  }

  @Delete('connections/:id')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    await this.prisma.pOSConnection.delete({ where: { id } });
    return { data: null, message: 'Deleted' };
  }

  @Post('connections/:id/test')
  async test(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const conn = await this.prisma.pOSConnection.findUnique({ where: { id } });
    if (!conn) return { data: { success: false, error: 'Not found' }, message: 'OK' };
    try {
      const creds = this.encryption.decryptJson<Record<string, unknown>>(conn.credentials);
      const adapter = this.factory.create(conn.provider, conn.credentials);
      await adapter.authenticate(creds);
      const outlets = await adapter.getOutlets();
      return { data: { success: true, outlets }, message: 'OK' };
    } catch (e) {
      return {
        data: { success: false, error: (e as Error).message },
        message: 'OK',
      };
    }
  }

  @Get('connections/:id/outlets')
  async outlets(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const conn = await this.prisma.pOSConnection.findUnique({ where: { id } });
    if (!conn) return { data: [], message: 'Not found' };
    const creds = this.encryption.decryptJson<Record<string, unknown>>(conn.credentials);
    const adapter = this.factory.create(conn.provider, conn.credentials);
    await adapter.authenticate(creds);
    const data = await adapter.getOutlets();
    return { data, message: 'OK' };
  }

  @Post('connections/:id/sync/products')
  async syncProducts(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const conn = await this.prisma.pOSConnection.findUnique({ where: { id } });
    if (!conn) return { data: null, message: 'Not found' };
    const jobId = await this.queue.addJob(JobType.POS_PRODUCT_SYNC, { connectionId: id });
    return { data: { jobId }, message: 'Queued' };
  }

  @Post('connections/:id/sync/inventory')
  async syncInventory(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const conn = await this.prisma.pOSConnection.findUnique({ where: { id } });
    if (!conn) return { data: null, message: 'Not found' };
    const jobId = await this.queue.addJob(JobType.POS_INVENTORY_SYNC, { connectionId: id });
    return { data: { jobId }, message: 'Queued' };
  }

  @Post('connections/:id/sync/customers')
  async syncCustomers(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const conn = await this.prisma.pOSConnection.findUnique({ where: { id } });
    if (!conn) return { data: null, message: 'Not found' };
    const memberships = await this.prisma.loyaltyMembership.findMany({
      select: { userId: true },
      take: 500,
    });
    for (const m of memberships) {
      await this.queue.addJob(JobType.POS_CUSTOMER_SYNC, { userId: m.userId });
    }
    return { data: { queued: memberships.length }, message: 'Queued' };
  }

  /**
   * Queue (or run) Lightspeed → HOS customer identity backfill for a connection.
   * Body: `{ "dryRun": true }` logs/counts only; `{ "dryRun": false }` applies stamps + mappings.
   * Pass `?sync=true` to run inline instead of queueing.
   */
  @Post('connections/:id/backfill/customer-identity')
  async backfillCustomerIdentity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { dryRun?: boolean },
    @Query('sync') sync?: string,
  ): Promise<ApiResponse<unknown>> {
    const conn = await this.prisma.pOSConnection.findUnique({ where: { id } });
    if (!conn) return { data: null, message: 'Not found' };
    // Default dryRun=true when omitted (safer).
    const dryRun = body?.dryRun === undefined ? true : !!body.dryRun;

    if (sync === 'true') {
      const summary = await this.customerIdentityBackfill.run({
        dryRun,
        connectionId: id,
      });
      return { data: summary, message: dryRun ? 'Dry run complete' : 'Backfill complete' };
    }

    const jobId = await this.queue.addJob(JobType.POS_CUSTOMER_IDENTITY_BACKFILL, {
      connectionId: id,
      dryRun,
    });
    return { data: { jobId, dryRun }, message: 'Queued' };
  }

  @Get('sales')
  async sales(@Query() q: PosSalesFilterDto): Promise<ApiResponse<unknown>> {
    const page = q.page || 1;
    const limit = q.limit || 20;
    const where: Record<string, unknown> = {};
    if (q.storeId) where.storeId = q.storeId;
    if (q.status) where.status = q.status;
    if (q.dateFrom || q.dateTo) {
      where.saleDate = {};
      if (q.dateFrom) (where.saleDate as any).gte = new Date(q.dateFrom);
      if (q.dateTo) (where.saleDate as any).lte = new Date(q.dateTo);
    }
    const [items, total] = await Promise.all([
      this.prisma.pOSSale.findMany({
        where,
        include: { store: { select: { name: true, code: true } }, items: true },
        orderBy: { saleDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.pOSSale.count({ where }),
    ]);
    return { data: { items, total, page, limit }, message: 'OK' };
  }

  @Get('sales/:id')
  async sale(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.pOSSale.findUnique({
      where: { id },
      include: { items: true, store: true },
    });
    return { data, message: 'OK' };
  }

  @Get('sync-log')
  async syncLog(): Promise<ApiResponse<unknown>> {
    const mappings = await this.prisma.externalEntityMapping.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });
    return { data: { mappings }, message: 'OK' };
  }

  @Get('discrepancies')
  async posDiscrepancies(): Promise<ApiResponse<unknown>> {
    const data = await this.discrepancies.getDiscrepancies({ type: 'INVENTORY', limit: 100 });
    return { data, message: 'OK' };
  }
}
