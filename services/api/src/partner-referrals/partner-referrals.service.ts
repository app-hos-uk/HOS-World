import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ReferralPartner, type ReferralPartnerLink } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { CreatePartnerDto } from './dto/create-partner.dto';
import { UpdatePartnerDto } from './dto/update-partner.dto';
import { CreatePartnerLinkDto } from './dto/create-partner-link.dto';
import { UpdatePartnerLinkDto } from './dto/update-partner-link.dto';
import { PartnerUrlService, PARTNER_CODE_RE } from './services/partner-url.service';

function slugifyBase(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}

export type PartnerListResult = {
  items: ReferralPartner[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class PartnerReferralsService {
  constructor(
    private prisma: PrismaService,
    private urlService: PartnerUrlService,
  ) {}

  async createPartner(dto: CreatePartnerDto): Promise<ReferralPartner> {
    this.assertContractRange(dto.contractStart, dto.contractEnd);

    const type = dto.type?.trim() || 'EXTERNAL';
    if (type === 'BRAND_PARTNER' && !dto.brandPartnershipId?.trim()) {
      throw new BadRequestException('brandPartnershipId is required for BRAND_PARTNER partners');
    }

    if (dto.brandPartnershipId) {
      await this.ensureBrandPartnership(dto.brandPartnershipId);
      await this.assertBrandPartnershipAvailable(dto.brandPartnershipId);
    }

    const slug = await this.allocateSlug(dto.name);

    try {
      return await this.prisma.referralPartner.create({
        data: {
          name: dto.name.trim(),
          slug,
          type,
          brandPartnershipId: dto.brandPartnershipId?.trim() || null,
          contactName: dto.contactName?.trim() || null,
          contactEmail: dto.contactEmail?.trim() || null,
          logoUrl: dto.logoUrl?.trim() || null,
          description: dto.description?.trim() || null,
          contractStart: dto.contractStart ? new Date(dto.contractStart) : null,
          contractEnd: dto.contractEnd ? new Date(dto.contractEnd) : null,
          metadata:
            dto.metadata === undefined ? undefined : (dto.metadata as Prisma.InputJsonValue),
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('A partner with this slug or brand partnership already exists');
      }
      throw e;
    }
  }

  async updatePartner(id: string, dto: UpdatePartnerDto): Promise<ReferralPartner> {
    const existing = await this.ensurePartner(id);
    this.assertContractRange(
      dto.contractStart ?? existing.contractStart?.toISOString(),
      dto.contractEnd ?? existing.contractEnd?.toISOString(),
    );

    if (dto.type === 'BRAND_PARTNER') {
      const brandId = dto.brandPartnershipId ?? existing.brandPartnershipId;
      if (!brandId) {
        throw new BadRequestException('brandPartnershipId is required for BRAND_PARTNER partners');
      }
    }

    if (dto.brandPartnershipId) {
      await this.ensureBrandPartnership(dto.brandPartnershipId);
      await this.assertBrandPartnershipAvailable(dto.brandPartnershipId, id);
    }

    const data: Prisma.ReferralPartnerUpdateInput = {};
    if (dto.name != null) data.name = dto.name.trim();
    if (dto.type != null) data.type = dto.type;
    if (dto.status != null) data.status = dto.status;
    if (dto.contactName !== undefined) data.contactName = dto.contactName?.trim() || null;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail?.trim() || null;
    if (dto.logoUrl !== undefined) data.logoUrl = dto.logoUrl?.trim() || null;
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.brandPartnershipId !== undefined) {
      data.brandPartnershipId = dto.brandPartnershipId?.trim() || null;
    }
    if (dto.contractStart !== undefined) {
      data.contractStart = dto.contractStart ? new Date(dto.contractStart) : null;
    }
    if (dto.contractEnd !== undefined) {
      data.contractEnd = dto.contractEnd ? new Date(dto.contractEnd) : null;
    }
    if (dto.metadata !== undefined) {
      data.metadata = dto.metadata as Prisma.InputJsonValue;
    }

    try {
      return await this.prisma.referralPartner.update({ where: { id }, data });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('A partner with this brand partnership already exists');
      }
      throw e;
    }
  }

  async getPartner(id: string): Promise<
    ReferralPartner & {
      links: ReferralPartnerLink[];
      _count: { links: number; conversions: number };
    }
  > {
    const partner = await this.prisma.referralPartner.findUnique({
      where: { id },
      include: {
        links: { orderBy: { createdAt: 'desc' } },
        _count: { select: { links: true, conversions: true } },
      },
    });
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }

  async listPartners(filters: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<PartnerListResult> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const where: Prisma.ReferralPartnerWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.search?.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
        { contactEmail: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.referralPartner.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { links: true, conversions: true } } },
      }),
      this.prisma.referralPartner.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async archivePartner(id: string): Promise<ReferralPartner> {
    await this.ensurePartner(id);
    return this.prisma.referralPartner.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  async createLink(partnerId: string, dto: CreatePartnerLinkDto): Promise<ReferralPartnerLink> {
    const partner = await this.ensurePartner(partnerId);
    if (partner.status !== 'ACTIVE') {
      throw new BadRequestException('Partner must be ACTIVE to create links');
    }

    const code = await this.allocateLinkCode(partner.slug, dto.name, dto.code);

    try {
      return await this.prisma.referralPartnerLink.create({
        data: {
          partnerId,
          code,
          name: dto.name.trim(),
          targetUrl: dto.targetUrl?.trim() || '/register',
          utmSource: dto.utmSource.trim(),
          utmMedium: dto.utmMedium?.trim() || 'referral',
          utmCampaign: dto.utmCampaign?.trim() || null,
          utmContent: dto.utmContent?.trim() || null,
          utmTerm: dto.utmTerm?.trim() || null,
          signupBonusPoints: dto.signupBonusPoints ?? 0,
          pointsMultiplier:
            dto.pointsMultiplier != null ? new Decimal(dto.pointsMultiplier) : null,
          multiplierDays: dto.multiplierDays ?? null,
          couponCode: dto.couponCode?.trim() || null,
          discountPercent: dto.discountPercent != null ? new Decimal(dto.discountPercent) : null,
          discountFixedAmount:
            dto.discountFixedAmount != null ? new Decimal(dto.discountFixedAmount) : null,
          maxRedemptions: dto.maxRedemptions ?? null,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('A partner link with this code already exists');
      }
      throw e;
    }
  }

  async updateLink(id: string, dto: UpdatePartnerLinkDto): Promise<ReferralPartnerLink> {
    await this.ensureLink(id);

    if (dto.code != null) {
      const nextCode = this.normalizeCode(dto.code);
      const clash = await this.prisma.referralPartnerLink.findUnique({ where: { code: nextCode } });
      if (clash && clash.id !== id) {
        throw new ConflictException('A partner link with this code already exists');
      }
    }

    const data: Prisma.ReferralPartnerLinkUpdateInput = {};
    if (dto.name != null) data.name = dto.name.trim();
    if (dto.code != null) data.code = this.normalizeCode(dto.code);
    if (dto.targetUrl !== undefined) data.targetUrl = dto.targetUrl?.trim() || '/register';
    if (dto.utmSource != null) data.utmSource = dto.utmSource.trim();
    if (dto.utmMedium !== undefined) data.utmMedium = dto.utmMedium?.trim() || 'referral';
    if (dto.utmCampaign !== undefined) data.utmCampaign = dto.utmCampaign?.trim() || null;
    if (dto.utmContent !== undefined) data.utmContent = dto.utmContent?.trim() || null;
    if (dto.utmTerm !== undefined) data.utmTerm = dto.utmTerm?.trim() || null;
    if (dto.signupBonusPoints !== undefined) data.signupBonusPoints = dto.signupBonusPoints;
    if (dto.pointsMultiplier !== undefined) {
      data.pointsMultiplier = dto.pointsMultiplier != null ? new Decimal(dto.pointsMultiplier) : null;
    }
    if (dto.multiplierDays !== undefined) data.multiplierDays = dto.multiplierDays;
    if (dto.couponCode !== undefined) data.couponCode = dto.couponCode?.trim() || null;
    if (dto.discountPercent !== undefined) {
      data.discountPercent = dto.discountPercent != null ? new Decimal(dto.discountPercent) : null;
    }
    if (dto.discountFixedAmount !== undefined) {
      data.discountFixedAmount =
        dto.discountFixedAmount != null ? new Decimal(dto.discountFixedAmount) : null;
    }
    if (dto.maxRedemptions !== undefined) data.maxRedemptions = dto.maxRedemptions;
    if (dto.expiresAt !== undefined) {
      data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    try {
      return await this.prisma.referralPartnerLink.update({ where: { id }, data });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('A partner link with this code already exists');
      }
      throw e;
    }
  }

  async getLink(id: string): Promise<
    ReferralPartnerLink & {
      partner: Pick<ReferralPartner, 'id' | 'name' | 'slug' | 'status' | 'logoUrl' | 'type'>;
      _count: { conversions: number };
    }
  > {
    const link = await this.prisma.referralPartnerLink.findUnique({
      where: { id },
      include: {
        partner: {
          select: { id: true, name: true, slug: true, status: true, logoUrl: true, type: true },
        },
        _count: { select: { conversions: true } },
      },
    });
    if (!link) throw new NotFoundException('Partner link not found');
    return link;
  }

  async listLinks(partnerId?: string): Promise<{ items: ReferralPartnerLink[]; total: number }> {
    if (partnerId) {
      await this.ensurePartner(partnerId);
    }
    const where: Prisma.ReferralPartnerLinkWhereInput = {};
    if (partnerId) where.partnerId = partnerId;

    const [items, total] = await Promise.all([
      this.prisma.referralPartnerLink.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          partner: { select: { id: true, name: true, slug: true, status: true } },
        },
      }),
      this.prisma.referralPartnerLink.count({ where }),
    ]);

    return { items, total };
  }

  async resolveLink(code: string): Promise<unknown> {
    const normalized = code?.trim();
    if (!normalized) {
      throw new BadRequestException('Referral code is required');
    }

    const link =
      (await this.prisma.referralPartnerLink.findUnique({
        where: { code: normalized },
        include: { partner: true },
      })) ??
      (normalized.toUpperCase() !== normalized
        ? await this.prisma.referralPartnerLink.findUnique({
            where: { code: normalized.toUpperCase() },
            include: { partner: true },
          })
        : null);

    if (!link) {
      throw new NotFoundException('Partner referral link not found');
    }
    if (!link.isActive) {
      throw new BadRequestException('This partner referral link is no longer active');
    }
    if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('This partner referral link has expired');
    }
    if (link.partner.status !== 'ACTIVE') {
      throw new BadRequestException('This partner is not currently accepting referrals');
    }

    const updated = await this.prisma.referralPartnerLink.update({
      where: { id: link.id },
      data: { totalClicks: { increment: 1 } },
    });

    return {
      code: link.code,
      name: link.name,
      targetUrl: link.targetUrl,
      partner: {
        id: link.partner.id,
        name: link.partner.name,
        slug: link.partner.slug,
        logoUrl: link.partner.logoUrl,
        description: link.partner.description,
      },
      offer: {
        signupBonusPoints: link.signupBonusPoints,
        pointsMultiplier: link.pointsMultiplier != null ? Number(link.pointsMultiplier) : null,
        multiplierDays: link.multiplierDays,
        couponCode: link.couponCode,
        discountPercent: link.discountPercent != null ? Number(link.discountPercent) : null,
        discountFixedAmount:
          link.discountFixedAmount != null ? Number(link.discountFixedAmount) : null,
      },
      utm: {
        source: link.utmSource,
        medium: link.utmMedium,
        campaign: link.utmCampaign,
        content: link.utmContent,
        term: link.utmTerm,
      },
      totalClicks: updated.totalClicks,
    };
  }

  async getLinkFullUrl(id: string): Promise<string> {
    const link = await this.ensureLink(id);
    return this.urlService.generateFullUrl(link);
  }

  async getLinkQrData(id: string): Promise<string> {
    const link = await this.ensureLink(id);
    return this.urlService.generateQrData(link);
  }

  private async ensurePartner(id: string): Promise<ReferralPartner> {
    const partner = await this.prisma.referralPartner.findUnique({ where: { id } });
    if (!partner) throw new NotFoundException('Partner not found');
    return partner;
  }

  private async ensureLink(id: string): Promise<ReferralPartnerLink> {
    const link = await this.prisma.referralPartnerLink.findUnique({ where: { id } });
    if (!link) throw new NotFoundException('Partner link not found');
    return link;
  }

  private async ensureBrandPartnership(id: string): Promise<void> {
    const partnership = await this.prisma.brandPartnership.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!partnership) {
      throw new BadRequestException('Brand partnership not found');
    }
  }

  private async assertBrandPartnershipAvailable(
    brandPartnershipId: string,
    excludePartnerId?: string,
  ): Promise<void> {
    const clash = await this.prisma.referralPartner.findUnique({
      where: { brandPartnershipId },
    });
    if (clash && clash.id !== excludePartnerId) {
      throw new ConflictException('This brand partnership is already linked to a referral partner');
    }
  }

  private assertContractRange(start?: string | null, end?: string | null): void {
    if (!start || !end) return;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Invalid contract dates');
    }
    if (startDate >= endDate) {
      throw new BadRequestException('contractStart must be before contractEnd');
    }
  }

  private async allocateSlug(name: string): Promise<string> {
    const base = slugifyBase(name) || 'partner';
    const existing = await this.prisma.referralPartner.findUnique({ where: { slug: base } });
    if (!existing) return base;
    for (let i = 0; i < 8; i++) {
      const slug = `${base}-${randomBytes(3).toString('hex')}`;
      const clash = await this.prisma.referralPartner.findUnique({ where: { slug } });
      if (!clash) return slug;
    }
    throw new BadRequestException('Unable to generate a unique partner slug');
  }

  private normalizeCode(code: string): string {
    const normalized = code.trim().toUpperCase().replace(/\s+/g, '-');
    if (!normalized) {
      throw new BadRequestException('Link code cannot be empty');
    }
    if (!PARTNER_CODE_RE.test(normalized)) {
      throw new BadRequestException(
        'Link code must match PARTNER-… format (e.g. PARTNER-HILTON-NYC-A7F2)',
      );
    }
    return normalized;
  }

  private async allocateLinkCode(
    partnerSlug: string,
    linkName: string,
    preferred?: string,
  ): Promise<string> {
    if (preferred?.trim()) {
      const code = this.normalizeCode(preferred);
      const exists = await this.prisma.referralPartnerLink.findUnique({ where: { code } });
      if (exists) {
        throw new ConflictException('A partner link with this code already exists');
      }
      return code;
    }

    for (let i = 0; i < 8; i++) {
      const code = this.urlService.generatePartnerCode(partnerSlug, linkName);
      const exists = await this.prisma.referralPartnerLink.findUnique({ where: { code } });
      if (!exists) return code;
    }
    throw new BadRequestException('Unable to generate a unique partner link code');
  }
}
