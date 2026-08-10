import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { normalizeCountryCode } from '../common/utils/country-code';
import { FeatureFlagsService } from '../config/feature-flags.service';
import { PlatformRegionService } from '../config/platform-region.service';
import { PrismaService } from '../database/prisma.service';
import { EncryptionService } from '../integrations/encryption.service';
import { isLoyaltyRuntimeEnabled } from '../loyalty/loyalty-enabled';
import { isPosRuntimeEnabled } from '../pos/pos-enabled';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { PlatformSellerService } from './platform-seller.service';

export const DEFAULT_ONBOARDING_STEP_DEFS: { key: string; label: string }[] = [
  { key: 'store_created', label: 'Store record created with address, timezone, currency' },
  { key: 'pos_connected', label: 'POS connection established and tested' },
  { key: 'products_assigned', label: 'Products assigned to store channel with local pricing' },
  { key: 'product_sync', label: 'Initial product sync to POS completed' },
  { key: 'inventory_loaded', label: 'Opening inventory loaded and synced' },
  { key: 'staff_trained', label: 'Staff trained on loyalty QR scan and point redemption' },
  { key: 'test_transaction', label: 'Test loyalty transaction processed end-to-end' },
  { key: 'signage_installed', label: 'Loyalty QR code signage installed in-store' },
  { key: 'marketing_configured', label: 'Tourist welcome journey configured for store region' },
  { key: 'go_live', label: 'Store marked active and visible to customers' },
];

function initialStepsJson(): Prisma.InputJsonValue {
  return DEFAULT_ONBOARDING_STEP_DEFS.map((s) => ({
    key: s.key,
    label: s.label,
    completedAt: null,
    completedBy: null,
  })) as unknown as Prisma.InputJsonValue;
}

function parseSteps(data: unknown): Array<{
  key: string;
  label: string;
  completedAt: string | null;
  completedBy: string | null;
}> {
  if (!Array.isArray(data)) return [];
  return data.map((row: any) => ({
    key: String(row.key),
    label: String(row.label ?? ''),
    completedAt: row.completedAt ? String(row.completedAt) : null,
    completedBy: row.completedBy ? String(row.completedBy) : null,
  }));
}

@Injectable()
export class StoreOnboardingService {
  constructor(
    private prisma: PrismaService,
    private region: PlatformRegionService,
    private platformSeller: PlatformSellerService,
    private encryption: EncryptionService,
    private config: ConfigService,
    private featureFlags: FeatureFlagsService,
  ) {}

  async createStore(dto: CreateStoreDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');

    const existingCode = await this.prisma.store.findUnique({
      where: { code: dto.code.trim().toUpperCase() },
    });
    if (existingCode) throw new BadRequestException('Store code already exists');

    const redeem =
      dto.loyaltyRedeemValue != null ? new Decimal(dto.loyaltyRedeemValue) : new Decimal(0.01);

    const region = await this.region.getRegion();
    const isoCode =
      normalizeCountryCode(dto.countryCode) || normalizeCountryCode(dto.country) || null;

    const sellerId =
      dto.sellerId?.trim() || (await this.platformSeller.resolvePlatformRetailSellerId());

    const hasLightspeed = !!dto.lightspeed;
    // One-step loyalty connect: activate when Lightspeed credentials are provided.
    const isActive = hasLightspeed ? true : false;

    const storeId = await this.prisma.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          tenantId: dto.tenantId,
          sellerId,
          name: dto.name,
          code: dto.code.trim().toUpperCase(),
          address: dto.address ?? null,
          city: dto.city ?? null,
          state: dto.state ?? null,
          country: dto.country ?? region.country,
          countryCode: isoCode ?? region.country,
          postalCode: dto.postalCode ?? null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          timezone: dto.timezone ?? region.timezone,
          currency: dto.currency ?? region.currency,
          contactEmail: dto.contactEmail ?? null,
          contactPhone: dto.contactPhone ?? null,
          managerName: dto.managerName ?? null,
          defaultRegionCode: dto.defaultRegionCode ?? region.country,
          loyaltyRedeemValue: redeem,
          isActive,
        },
      });

      await tx.storeOnboardingChecklist.create({
        data: {
          storeId: store.id,
          steps: initialStepsJson(),
          status: hasLightspeed ? 'COMPLETED' : 'IN_PROGRESS',
          ...(hasLightspeed ? { completedAt: new Date() } : {}),
        },
      });

      if (dto.lightspeed) {
        const ls = dto.lightspeed;
        const credentials = this.encryption.encrypt(
          JSON.stringify({
            domainPrefix: ls.domainPrefix,
            clientId: ls.clientId,
            clientSecret: ls.clientSecret,
            accessToken: ls.accessToken,
            refreshToken: ls.refreshToken,
          }),
        );
        await tx.pOSConnection.create({
          data: {
            sellerId,
            storeId: store.id,
            provider: 'lightspeed',
            credentials,
            externalOutletId: ls.externalOutletId ?? null,
            webhookSecret: ls.webhookSecret ?? null,
            autoSyncProducts: false,
            autoSyncInventory: false,
            isActive: true,
          },
        });
      }

      return store.id;
    });

    return this.getStore(storeId);
  }

  async listStores() {
    return this.prisma.store.findMany({
      orderBy: { name: 'asc' },
      include: {
        onboardingChecklist: true,
        tenant: { select: { id: true, name: true } },
      },
    });
  }

  async getStore(id: string) {
    const store = await this.prisma.store.findUnique({
      where: { id },
      include: {
        onboardingChecklist: true,
        tenant: { select: { id: true, name: true } },
        posConnection: {
          select: {
            id: true,
            provider: true,
            isActive: true,
            externalOutletId: true,
            lastSaleImportedAt: true,
            syncStatus: true,
          },
        },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async updateStore(id: string, dto: UpdateStoreDto) {
    await this.getStore(id);
    const data: Prisma.StoreUpdateInput = {};
    if (dto.sellerId !== undefined) {
      data.seller = dto.sellerId ? { connect: { id: dto.sellerId } } : { disconnect: true };
    }
    if (dto.name != null) data.name = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.country !== undefined) data.country = dto.country;
    if (dto.countryCode !== undefined || dto.country !== undefined) {
      data.countryCode =
        normalizeCountryCode(dto.countryCode) || normalizeCountryCode(dto.country) || undefined;
    }
    if (dto.postalCode !== undefined) data.postalCode = dto.postalCode;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.timezone !== undefined) data.timezone = dto.timezone;
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone;
    if (dto.managerName !== undefined) data.managerName = dto.managerName;
    if (dto.defaultRegionCode !== undefined) data.defaultRegionCode = dto.defaultRegionCode;
    if (dto.loyaltyRedeemValue != null) {
      data.loyaltyRedeemValue = new Decimal(dto.loyaltyRedeemValue);
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    await this.prisma.store.update({ where: { id }, data });
    return this.getStore(id);
  }

  async completeOnboardingStep(storeId: string, stepKey: string, completedBy?: string) {
    const store = await this.getStore(storeId);
    const checklist = store.onboardingChecklist;
    if (!checklist) {
      throw new BadRequestException('Onboarding checklist missing');
    }
    const steps = parseSteps(checklist.steps);
    const idx = steps.findIndex((s) => s.key === stepKey);
    if (idx < 0) throw new BadRequestException('Unknown onboarding step');
    const now = new Date().toISOString();
    steps[idx] = {
      ...steps[idx],
      completedAt: now,
      completedBy: completedBy ?? null,
    };
    await this.prisma.storeOnboardingChecklist.update({
      where: { storeId },
      data: { steps: steps as unknown as Prisma.InputJsonValue },
    });
    return this.getStore(storeId);
  }

  async finishOnboarding(storeId: string) {
    const store = await this.getStore(storeId);
    const checklist = store.onboardingChecklist;
    if (!checklist) throw new BadRequestException('Onboarding checklist missing');
    const steps = parseSteps(checklist.steps);
    const incomplete = steps.filter((s) => !s.completedAt);
    if (incomplete.length > 0) {
      throw new BadRequestException(
        `Cannot complete onboarding: ${incomplete.length} step(s) remaining`,
      );
    }
    await this.prisma.storeOnboardingChecklist.update({
      where: { storeId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    return this.getStore(storeId);
  }

  async activateStore(storeId: string) {
    await this.getStore(storeId);
    await this.prisma.store.update({
      where: { id: storeId },
      data: { isActive: true },
    });
    const updated = await this.getStore(storeId);

    if (updated.onboardingChecklist && updated.onboardingChecklist.status !== 'COMPLETED') {
      await this.prisma.storeOnboardingChecklist.update({
        where: { storeId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
    }
    return this.getStore(storeId);
  }

  async deactivateStore(storeId: string) {
    await this.getStore(storeId);
    await this.prisma.store.update({
      where: { id: storeId },
      data: { isActive: false },
    });
    return this.getStore(storeId);
  }

  async deleteStore(storeId: string) {
    const storeName = await this.prisma.$transaction(async (tx) => {
      const store = await tx.store.findUnique({
        where: { id: storeId },
        include: {
          clickCollectOrders: { select: { id: true }, take: 1 },
          loyaltyPosVouchers: { select: { id: true }, take: 1 },
        },
      });
      if (!store) throw new NotFoundException('Store not found');
      if (store.clickCollectOrders.length > 0) {
        throw new BadRequestException(
          'Cannot delete store with click-and-collect orders. Remove or reassign them first.',
        );
      }
      if (store.loyaltyPosVouchers.length > 0) {
        throw new BadRequestException(
          'Cannot delete store with loyalty voucher records. Archive them first.',
        );
      }

      await tx.storeOnboardingChecklist.deleteMany({ where: { storeId } });
      await tx.pOSSale.deleteMany({ where: { storeId } });
      await tx.pOSConnection.deleteMany({ where: { storeId } });
      await tx.productChannel.deleteMany({ where: { storeId } });
      await tx.config.deleteMany({ where: { storeId } });
      await tx.user.updateMany({ where: { storeId }, data: { storeId: null } });
      await tx.event.updateMany({ where: { storeId }, data: { storeId: null } });
      await tx.store.delete({ where: { id: storeId } });
      return store.name;
    });

    return { deleted: true, id: storeId, name: storeName };
  }

  async getReadiness(storeId: string) {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      include: {
        posConnection: {
          select: {
            id: true,
            isActive: true,
            credentials: true,
            externalOutletId: true,
            lastSaleImportedAt: true,
          },
        },
        posSales: { select: { id: true }, take: 1 },
      },
    });
    if (!store) throw new NotFoundException('Store not found');

    const posRuntime = isPosRuntimeEnabled(this.config, this.featureFlags);
    const loyaltyRuntime = isLoyaltyRuntimeEnabled(this.config, this.featureFlags);
    const conn = store.posConnection;
    const hasPosConnection = !!conn;
    const posActive = conn?.isActive === true;
    const hasCredentials = !!conn?.credentials;
    const outletMapped = !!(conn?.externalOutletId || store.externalStoreId);
    const salesFlowing = store.posSales.length > 0 || !!conn?.lastSaleImportedAt;

    const checks = [
      { key: 'pos_runtime', label: 'POS runtime enabled', ok: posRuntime },
      { key: 'loyalty_runtime', label: 'Loyalty runtime enabled', ok: loyaltyRuntime },
      { key: 'pos_connection', label: 'POS connection created', ok: hasPosConnection },
      { key: 'pos_active', label: 'POS connection active', ok: posActive },
      { key: 'credentials', label: 'POS credentials present', ok: hasCredentials },
      { key: 'outlet_mapped', label: 'Outlet mapped (externalOutletId)', ok: outletMapped },
      { key: 'sales_flowing', label: 'Sales flowing from POS', ok: salesFlowing },
    ];

    return { checks, allPassed: checks.every((c) => c.ok) };
  }

  /** Ensure legacy stores have a checklist row (for seeds / migrations). */
  async ensureChecklist(storeId: string) {
    const found = await this.prisma.storeOnboardingChecklist.findUnique({ where: { storeId } });
    if (found) return found;
    return this.prisma.storeOnboardingChecklist.create({
      data: {
        storeId,
        steps: initialStepsJson(),
        status: 'IN_PROGRESS',
      },
    });
  }
}
