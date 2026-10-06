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
import { PosCustomerImportService } from './sync/customer-import.service';
import { PosSalesImportService } from './sync/sales-import.service';
import { QueueService, JobType } from '../queue/queue.service';
import { DiscrepanciesService } from '../discrepancies/discrepancies.service';
import { PlatformSellerService } from '../stores/platform-seller.service';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';
import { FeatureFlag, FeatureFlagsService } from '../config/feature-flags.service';
import { PosProductImportService } from './sync/product-import.service';
import { ActivityService } from '../activity/activity.service';

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
    private customerImport: PosCustomerImportService,
    private salesImport: PosSalesImportService,
    private queue: QueueService,
    private discrepancies: DiscrepanciesService,
    private platformSeller: PlatformSellerService,
    private featureFlags: FeatureFlagsService,
    private productImport: PosProductImportService,
    private activityService: ActivityService,
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

  private static readonly SENSITIVE_JOB_KEYS = new Set([
    'credentials', 'accessToken', 'refreshToken', 'clientSecret',
    'webhookSecret', 'password', 'token', 'apiKey',
  ]);

  /** Strip credentials/tokens from job payloads before returning to the admin UI. */
  private sanitizeJobPayload(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (PosAdminController.SENSITIVE_JOB_KEYS.has(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = v;
      }
    }
    return out;
  }

  /** Truncate error messages and strip file paths / stack traces. */
  private sanitizeErrorMessage(msg?: string | null): string | null {
    if (!msg) return null;
    const cleaned = msg
      .replace(/\/[\w/.-]+\.(ts|js):\d+:\d+/g, '[path]')
      .replace(/at\s+[\w$.]+\s+\([^)]+\)/g, '')
      .trim();
    return cleaned.length > 500 ? cleaned.slice(0, 500) + '…' : cleaned;
  }

  @Get('connections')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async listConnections(): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.pOSConnection.findMany({
      include: { store: { select: { id: true, name: true, code: true, city: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const body: ApiResponse<unknown> = {
      data: data.map((c) => this.sanitizeConnection(c)),
      message: 'OK',
    };
    return Object.assign(body, {
      productPushEnabled: this.featureFlags.isEnabled(FeatureFlag.POS_PRODUCT_PUSH),
    });
  }

  @Post('connections')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
  async create(@Body() dto: CreatePosConnectionDto): Promise<ApiResponse<unknown>> {
    const store = await this.prisma.store.findUnique({
      where: { id: dto.storeId },
      include: { seller: true },
    });
    if (!store) {
      throw new BadRequestException('Store not found');
    }
    let sellerId = store.sellerId;
    if (!sellerId) {
      sellerId = await this.platformSeller.resolvePlatformRetailSellerId();
      await this.prisma.store.update({
        where: { id: store.id },
        data: { sellerId },
      });
    }
    const enc = this.encryption.encrypt(JSON.stringify(dto.credentials));
    const data = await this.prisma.pOSConnection.create({
      data: {
        sellerId,
        storeId: dto.storeId,
        provider: dto.provider.toLowerCase(),
        credentials: enc,
        externalOutletId: dto.externalOutletId,
        externalRegisterId: dto.externalRegisterId,
        webhookSecret: dto.webhookSecret,
        autoSyncProducts:
          dto.autoSyncProducts ?? this.featureFlags.isEnabled(FeatureFlag.POS_PRODUCT_PUSH),
        autoSyncInventory: dto.autoSyncInventory ?? true,
        syncIntervalMinutes: dto.syncIntervalMinutes ?? 60,
      },
      include: { store: true },
    });
    return { data: this.sanitizeConnection(data), message: 'Created' };
  }

  @Put('connections/:id')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
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
    if (dto.storeId !== undefined) {
      const targetStore = await this.prisma.store.findUnique({
        where: { id: dto.storeId },
        include: { seller: true },
      });
      if (!targetStore) throw new BadRequestException('Target store not found');
      const existingConn = await this.prisma.pOSConnection.findFirst({
        where: { storeId: dto.storeId, id: { not: id } },
      });
      if (existingConn) {
        throw new BadRequestException('Target store already has a POS connection');
      }
      update.storeId = dto.storeId;
      let sellerId = targetStore.sellerId;
      if (!sellerId) {
        sellerId = await this.platformSeller.resolvePlatformRetailSellerId();
      }
      update.sellerId = sellerId;
    }
    if (dto.externalOutletId !== undefined) update.externalOutletId = dto.externalOutletId;
    if (dto.externalRegisterId !== undefined) update.externalRegisterId = dto.externalRegisterId;
    if (dto.webhookSecret !== undefined) update.webhookSecret = dto.webhookSecret;
    if (dto.autoSyncProducts !== undefined) update.autoSyncProducts = dto.autoSyncProducts;
    if (dto.autoSyncInventory !== undefined) update.autoSyncInventory = dto.autoSyncInventory;
    if (dto.isActive !== undefined) update.isActive = dto.isActive;
    if (dto.syncIntervalMinutes !== undefined) update.syncIntervalMinutes = dto.syncIntervalMinutes;
    if (dto.settings) {
      const existing = await this.prisma.pOSConnection.findUnique({
        where: { id },
        select: { settings: true },
      });
      const prev = existing?.settings;
      const current =
        prev && typeof prev === 'object' && !Array.isArray(prev) ? prev : {};
      update.settings = { ...(current as Record<string, unknown>), ...dto.settings };
    }

    const data = await this.prisma.pOSConnection.update({
      where: { id },
      data: update as any,
      include: { store: true },
    });
    return { data: this.sanitizeConnection(data), message: 'Updated' };
  }

  @Delete('connections/:id')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    await this.prisma.pOSConnection.delete({ where: { id } });
    return { data: null, message: 'Deleted' };
  }

  @Post('connections/:id/test')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
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
      const raw = (e as Error).message || 'Connection test failed';
      return {
        data: { success: false, error: this.sanitizeErrorMessage(raw) },
        message: 'OK',
      };
    }
  }

  @Get('connections/:id/outlets')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
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
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
  async syncProducts(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    if (!this.featureFlags.isEnabled(FeatureFlag.POS_PRODUCT_PUSH)) {
      throw new BadRequestException(
        'Product push to the POS is disabled. Pull a product into a submission instead.',
      );
    }
    const conn = await this.prisma.pOSConnection.findUnique({ where: { id } });
    if (!conn) return { data: null, message: 'Not found' };
    const jobId = await this.queue.addJob(JobType.POS_PRODUCT_SYNC, { connectionId: id });
    return { data: { jobId }, message: 'Queued' };
  }

  @Get('connections/:id/products/search')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async searchPosProducts(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('sku') sku?: string,
    @Query('query') query?: string,
    @Query('externalId') externalId?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.productImport.search({ connectionId: id, sku, query, externalId });
    return { data, message: 'OK' };
  }

  @Get('connections/:id/products/:externalId/preview')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async previewPosProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('externalId') externalId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.productImport.preview(id, externalId);
    return { data, message: 'OK' };
  }

  @Post('connections/:id/sync/inventory')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
  async syncInventory(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const conn = await this.prisma.pOSConnection.findUnique({ where: { id } });
    if (!conn) return { data: null, message: 'Not found' };
    const jobId = await this.queue.addJob(JobType.POS_INVENTORY_SYNC, { connectionId: id });
    return { data: { jobId }, message: 'Queued' };
  }

  @Post('connections/:id/sync/sales')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
  async syncSales(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const conn = await this.prisma.pOSConnection.findUnique({ where: { id } });
    if (!conn) return { data: null, message: 'Not found' };
    if (!conn.isActive) {
      throw new BadRequestException('POS connection is inactive');
    }
    const jobId = await this.queue.addJob(JobType.POS_SALES_POLL, { storeId: conn.storeId });
    return { data: { jobId, storeId: conn.storeId }, message: 'Queued' };
  }

  @Post('connections/:id/sync/customers')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
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
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
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

  /**
   * Queue (or run) Lightspeed → HOS customer import for a connection.
   * Creates Users + LoyaltyMemberships for Lightspeed customers with email,
   * upserts ExternalEntityMapping, and stamps customer_code / custom_field_1.
   * Body: `{ "dryRun": true }` logs/counts only; `{ "dryRun": false }` applies changes.
   * Pass `?sync=true` to run inline instead of queueing.
   */
  @Post('connections/:id/import/customers')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
  async importCustomers(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { dryRun?: boolean },
    @Query('sync') sync?: string,
  ): Promise<ApiResponse<unknown>> {
    const conn = await this.prisma.pOSConnection.findUnique({ where: { id } });
    if (!conn) return { data: null, message: 'Not found' };
    // Default dryRun=true when omitted (safer).
    const dryRun = body?.dryRun === undefined ? true : !!body.dryRun;

    if (sync === 'true') {
      const summary = await this.customerImport.run({
        dryRun,
        connectionId: id,
      });
      return { data: summary, message: dryRun ? 'Dry run complete' : 'Import complete' };
    }

    const jobId = await this.queue.addJob(JobType.POS_CUSTOMER_IMPORT, {
      connectionId: id,
      dryRun,
    });
    return { data: { jobId, dryRun }, message: 'Queued' };
  }

  /**
   * Queue (or run) retroactive customerId linking on imported POS sales for a connection.
   * Body defaults are safe: `{ "dryRun": true, "earnPoints": false }`.
   * Pass `?sync=true` to run inline instead of queueing.
   * Historical sales are link-only unless earnPoints is explicitly true.
   */
  @Post('connections/:id/backfill/sales-links')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
  async backfillSaleCustomerLinks(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { dryRun?: boolean; earnPoints?: boolean },
    @Query('sync') sync?: string,
  ): Promise<ApiResponse<unknown>> {
    const conn = await this.prisma.pOSConnection.findUnique({ where: { id } });
    if (!conn) return { data: null, message: 'Not found' };
    // Default dryRun=true / earnPoints=false when omitted (safer).
    const dryRun = body?.dryRun === undefined ? true : !!body.dryRun;
    const earnPoints = body?.earnPoints === true;

    if (sync === 'true') {
      const summary = await this.salesImport.backfillSaleCustomerLinks(conn.storeId, {
        dryRun,
        earnPoints,
      });
      return {
        data: summary,
        message: dryRun ? 'Dry run complete' : 'Backfill complete',
      };
    }

    const jobId = await this.queue.addJob(JobType.POS_SALES_LINK_BACKFILL, {
      storeId: conn.storeId,
      connectionId: id,
      dryRun,
      earnPoints,
    });
    return { data: { jobId, storeId: conn.storeId, dryRun, earnPoints }, message: 'Queued' };
  }

  @Get('sales')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async sales(@Query() q: PosSalesFilterDto): Promise<ApiResponse<unknown>> {
    const page = q.page || 1;
    const limit = q.limit || 20;
    const where: Record<string, unknown> = {};
    if (q.storeId) where.storeId = q.storeId;
    if (q.customerId) where.customerId = q.customerId;
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
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async sale(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.prisma.pOSSale.findUnique({
      where: { id },
      include: { items: true, store: true },
    });
    return { data, message: 'OK' };
  }

  @Get('sync-log')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async syncLog(): Promise<ApiResponse<unknown>> {
    const mappings = await this.prisma.externalEntityMapping.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 40,
    });
    return { data: { mappings }, message: 'OK' };
  }

  @Get('discrepancies')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async posDiscrepancies(): Promise<ApiResponse<unknown>> {
    const data = await this.discrepancies.getDiscrepancies({ type: 'INVENTORY', limit: 100 });
    return { data, message: 'OK' };
  }

  // ──────── Job / Cron Management ────────

  @Get('jobs/stats')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async jobStats(): Promise<ApiResponse<unknown>> {
    const stats = await this.queue.getQueueStats();
    return { data: stats, message: 'OK' };
  }

  @Get('jobs/crons')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async listCrons(): Promise<ApiResponse<unknown>> {
    const crons = await this.queue.getRepeatableJobs();
    const posCrons = crons.filter((c) => c.name.startsWith('pos:'));
    return { data: posCrons, message: 'OK' };
  }

  @Post('jobs/crons/:name/disable')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
  async disableCron(
    @Param('name') name: string,
    @Body() body: { pattern: string },
  ): Promise<ApiResponse<unknown>> {
    if (!name.startsWith('pos:')) {
      throw new BadRequestException('Only POS cron jobs can be managed here');
    }
    if (!body.pattern || !/^[0-9*/,\- ]+$/.test(body.pattern)) {
      throw new BadRequestException('Invalid cron pattern');
    }
    const removed = await this.queue.removeRepeatable(name, body.pattern);
    if (removed) {
      await this.activityService.createLog({
        action: 'POS_CRON_DISABLED',
        entityType: 'POS_JOB',
        entityId: name,
        description: `Disabled POS cron job ${name} (${body.pattern})`,
        metadata: { name, pattern: body.pattern },
      });
    }
    return { data: { removed }, message: removed ? 'Disabled' : 'Not found' };
  }

  @Post('jobs/crons/:name/enable')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
  async enableCron(
    @Param('name') name: string,
    @Body() body: { pattern: string },
  ): Promise<ApiResponse<unknown>> {
    if (!name.startsWith('pos:')) {
      throw new BadRequestException('Only POS cron jobs can be managed here');
    }
    const ALLOWED_CRON_PATTERNS = new Set([
      '0 2 * * *',
      '*/15 * * * *',
      '0 */6 * * *',
      '0 3 * * *',
      '*/30 * * * *',
      '0 * * * *',
      '0 4 * * *',
    ]);
    if (!body.pattern || !ALLOWED_CRON_PATTERNS.has(body.pattern)) {
      throw new BadRequestException(
        `Invalid cron pattern. Allowed: ${[...ALLOWED_CRON_PATTERNS].join(', ')}`,
      );
    }
    await this.queue.addRepeatable(name as JobType, {}, body.pattern);
    await this.activityService.createLog({
      action: 'POS_CRON_ENABLED',
      entityType: 'POS_JOB',
      entityId: name,
      description: `Enabled POS cron job ${name} (${body.pattern})`,
      metadata: { name, pattern: body.pattern },
    });
    return { data: { enabled: true }, message: 'Enabled' };
  }

  @Post('jobs/crons/:name/trigger')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
  async triggerCronNow(@Param('name') name: string): Promise<ApiResponse<unknown>> {
    if (!name.startsWith('pos:')) {
      throw new BadRequestException('Only POS cron jobs can be triggered here');
    }
    if (!Object.values(JobType).includes(name as JobType)) {
      throw new BadRequestException(`Unknown job type: ${name}`);
    }
    const jobId = await this.queue.addJob(name as JobType, {});
    await this.activityService.createLog({
      action: 'POS_CRON_TRIGGERED',
      entityType: 'POS_JOB',
      entityId: name,
      description: `Manually triggered POS job ${name}`,
      metadata: { name, jobId },
    });
    return { data: { jobId }, message: 'Queued' };
  }

  @Get('jobs/recent')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async recentJobs(
    @Query('type') type?: string,
    @Query('status') status?: 'completed' | 'failed' | 'active' | 'waiting' | 'delayed',
  ): Promise<ApiResponse<unknown>> {
    const jobs = await this.queue.getRecentJobs(type, status || 'completed', 0, 30);
    const posJobs = type ? jobs : jobs.filter((j) => j.name.startsWith('pos:'));
    const sanitized = posJobs.map((j) => ({
      ...j,
      data: this.sanitizeJobPayload(j.data),
      failedReason: this.sanitizeErrorMessage(j.failedReason),
      returnvalue: undefined,
    }));
    return { data: sanitized, message: 'OK' };
  }

  @Get('jobs/dlq')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async dlqJobs(): Promise<ApiResponse<unknown>> {
    const jobs = await this.queue.getDLQJobs(0, 50);
    const mapped = jobs
      .filter((j) => j.name.startsWith('pos:'))
      .map((j) => ({
        id: j.id,
        name: j.name,
        data: this.sanitizeJobPayload(j.data),
        attemptsMade: j.attemptsMade,
        failedReason: this.sanitizeErrorMessage(j.failedReason),
        timestamp: j.timestamp,
      }));
    return { data: mapped, message: 'OK' };
  }

  @Post('jobs/dlq/:jobId/retry')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
  async retryDlqJob(@Param('jobId') jobId: string): Promise<ApiResponse<unknown>> {
    const dlqJobs = await this.queue.getDLQJobs(0, 200);
    const target = dlqJobs.find((j) => j.id === jobId);
    if (!target || !target.name.startsWith('pos:')) {
      return { data: { retried: false }, message: 'POS DLQ job not found' };
    }
    const retried = await this.queue.retryDLQJob(jobId);
    if (retried) {
      await this.activityService.createLog({
        action: 'POS_DLQ_RETRY',
        entityType: 'POS_JOB',
        entityId: jobId,
        description: `Retried DLQ job ${jobId}`,
        metadata: { jobId },
      });
    }
    return { data: { retried }, message: retried ? 'Re-queued' : 'Not found' };
  }

  @Post('jobs/dlq/purge')
  @RequireAccess({ permission: 'stores.manage', scope: 'GLOBAL' })
  async purgeDlq(): Promise<ApiResponse<unknown>> {
    const count = await this.queue.purgeDLQ('pos:');
    await this.activityService.createLog({
      action: 'POS_DLQ_PURGED',
      entityType: 'POS_JOB',
      description: `Purged ${count} jobs from DLQ`,
      metadata: { count },
    });
    return { data: { purged: count }, message: 'Purged' };
  }

  @Get('jobs/:jobId')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async jobDetail(@Param('jobId') jobId: string): Promise<ApiResponse<unknown>> {
    const job = await this.queue.getJob(jobId);
    if (!job) return { data: null, message: 'Not found' };
    return {
      data: {
        ...job,
        data: this.sanitizeJobPayload(job.data),
        failedReason: this.sanitizeErrorMessage(job.failedReason),
        returnvalue: undefined,
      },
      message: 'OK',
    };
  }

  // ──────── Activity Logs ────────

  @Get('activity')
  @RequireAccess({ permission: 'stores.view', scope: 'GLOBAL' })
  async posActivity(
    @Query('action') action?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 50, 100) : 50;
    const data = await this.activityService.getLogs({
      entityType: 'POS_PRODUCT_PULL',
      action,
      page: page ? parseInt(page, 10) : 1,
      limit: parsedLimit,
    });
    return { data, message: 'OK' };
  }
}
