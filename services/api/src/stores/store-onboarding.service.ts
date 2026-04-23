import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../database/prisma.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

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
  constructor(private prisma: PrismaService) {}

  async createStore(dto: CreateStoreDto) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: dto.tenantId } });
    if (!tenant) throw new BadRequestException('Tenant not found');

    const existingCode = await this.prisma.store.findUnique({
      where: { code: dto.code.trim().toUpperCase() },
    });
    if (existingCode) throw new BadRequestException('Store code already exists');

    const redeem =
      dto.loyaltyRedeemValue != null ? new Decimal(dto.loyaltyRedeemValue) : new Decimal(0.01);

    const store = await this.prisma.store.create({
      data: {
        tenantId: dto.tenantId,
        sellerId: dto.sellerId ?? null,
        name: dto.name,
        code: dto.code.trim().toUpperCase(),
        address: dto.address ?? null,
        city: dto.city ?? null,
        state: dto.state ?? null,
        country: dto.country ?? 'GB',
        postalCode: dto.postalCode ?? null,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        timezone: dto.timezone ?? 'Europe/London',
        currency: dto.currency ?? 'GBP',
        contactEmail: dto.contactEmail ?? null,
        contactPhone: dto.contactPhone ?? null,
        managerName: dto.managerName ?? null,
        defaultRegionCode: dto.defaultRegionCode ?? 'GB',
        loyaltyRedeemValue: redeem,
        isActive: false,
      },
    });

    await this.prisma.storeOnboardingChecklist.create({
      data: {
        storeId: store.id,
        steps: initialStepsJson(),
        status: 'IN_PROGRESS',
      },
    });

    return this.getStore(store.id);
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
        posConnection: { select: { id: true, provider: true, isActive: true } },
      },
    });
    if (!store) throw new NotFoundException('Store not found');
    return store;
  }

  async updateStore(id: string, dto: UpdateStoreDto) {
    const existing = await this.getStore(id);
    if (dto.isActive === true) {
      const checklist = existing.onboardingChecklist;
      if (!checklist || checklist.status !== 'COMPLETED') {
        throw new BadRequestException(
          'Store onboarding must be completed before activation; use POST /admin/stores/:id/activate',
        );
      }
    }
    const data: Prisma.StoreUpdateInput = {};
    if (dto.name != null) data.name = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.city !== undefined) data.city = dto.city;
    if (dto.state !== undefined) data.state = dto.state;
    if (dto.country !== undefined) data.country = dto.country;
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
    const store = await this.getStore(storeId);
    const checklist = store.onboardingChecklist;
    if (!checklist || checklist.status !== 'COMPLETED') {
      throw new BadRequestException('Store onboarding must be completed before activation');
    }
    await this.prisma.store.update({
      where: { id: storeId },
      data: { isActive: true },
    });
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
