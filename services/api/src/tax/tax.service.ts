import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateTaxZoneDto } from './dto/create-tax-zone.dto';
import { CreateTaxClassDto } from './dto/create-tax-class.dto';
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class TaxService {
  private readonly logger = new Logger(TaxService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a tax zone
   */
  async createTaxZone(createDto: CreateTaxZoneDto | any) {
    // Handle both DTO format (countries array) and simple format (individual fields)
    let country: string | undefined;
    let state: string | undefined;
    let city: string | undefined;
    let postalCodes: string[] = [];
    let isActive = true;

    if (createDto.countries && Array.isArray(createDto.countries) && createDto.countries.length > 0) {
      // DTO format with countries array
      const primaryCountry = createDto.countries[0];
      country = primaryCountry?.country;
      state = primaryCountry?.state;
      city = primaryCountry?.city;
      postalCodes = createDto.countries.map((c: any) => c.postalCode).filter(Boolean) as string[];
      isActive = createDto.isActive ?? true;
    } else {
      // Simple format with individual fields (for API flexibility)
      country = createDto.country;
      state = createDto.state;
      city = createDto.city;
      postalCodes = createDto.postalCodes || [];
      isActive = createDto.isActive ?? true;
    }

    return this.prisma.taxZone.create({
      data: {
        name: createDto.name,
        country: country || null,
        state: state || null,
        city: city || null,
        postalCodes: postalCodes || [],
        isActive,
      },
    });
  }

  /**
   * Get all tax zones
   */
  async findAllTaxZones(includeInactive = false) {
    return this.prisma.taxZone.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: {
        rates: {
          where: { isActive: true },
          include: {
            taxClass: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get tax zone by ID
   */
  async findTaxZoneById(id: string) {
    const zone = await this.prisma.taxZone.findUnique({
      where: { id },
      include: {
        rates: {
          include: {
            taxClass: true,
          },
        },
      },
    });

    if (!zone) {
      throw new NotFoundException('Tax zone not found');
    }

    return zone;
  }

  /**
   * Create a tax class
   */
  async createTaxClass(createDto: CreateTaxClassDto) {
    return this.prisma.taxClass.create({
      data: {
        name: createDto.name,
        description: createDto.description,
      },
    });
  }

  /**
   * Get all tax classes
   */
  async findAllTaxClasses() {
    return this.prisma.taxClass.findMany({
      include: {
        rates: {
          where: { isActive: true },
          include: {
            taxZone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get tax class by ID
   */
  async findTaxClassById(id: string) {
    const taxClass = await this.prisma.taxClass.findUnique({
      where: { id },
      include: {
        rates: {
          include: {
            taxZone: true,
          },
        },
      },
    });

    if (!taxClass) {
      throw new NotFoundException('Tax class not found');
    }

    return taxClass;
  }

  /**
   * Get all tax rates with optional filters
   */
  async findAllTaxRates(taxZoneId?: string, taxClassId?: string) {
    const where: any = {};
    if (taxZoneId) {
      where.taxZoneId = taxZoneId;
    }
    if (taxClassId) {
      where.taxClassId = taxClassId;
    }

    return this.prisma.taxRate.findMany({
      where,
      include: {
        taxZone: {
          select: {
            id: true,
            name: true,
            country: true,
            state: true,
            city: true,
          },
        },
        taxClass: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get tax rate by ID
   */
  async findTaxRateById(id: string) {
    const rate = await this.prisma.taxRate.findUnique({
      where: { id },
      include: {
        taxZone: true,
        taxClass: true,
      },
    });

    if (!rate) {
      throw new NotFoundException('Tax rate not found');
    }

    return rate;
  }

  /**
   * Create a tax rate
   */
  async createTaxRate(createDto: CreateTaxRateDto | any) {
    // Verify tax zone exists
    await this.findTaxZoneById(createDto.taxZoneId);

    // Verify tax class exists if provided (it's optional - null means default rate)
    if (createDto.taxClassId && createDto.taxClassId.trim() !== '') {
      await this.findTaxClassById(createDto.taxClassId);
    }

    const taxClassId = createDto.taxClassId && createDto.taxClassId.trim() !== '' ? createDto.taxClassId : null;

    // Check if rate already exists for this zone/class combination
    const existing = await this.prisma.taxRate.findFirst({
      where: {
        taxZoneId: createDto.taxZoneId,
        taxClassId,
      },
    });

    if (existing) {
      throw new BadRequestException(
        'Tax rate already exists for this zone and class combination',
      );
    }

    return this.prisma.taxRate.create({
      data: {
        taxZoneId: createDto.taxZoneId,
        taxClassId,
        rate: new Decimal(createDto.rate),
        isInclusive: createDto.isInclusive ?? false,
        isActive: createDto.isActive ?? true,
      },
      include: {
        taxZone: {
          select: {
            id: true,
            name: true,
            country: true,
            state: true,
            city: true,
          },
        },
        taxClass: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    });
  }

  /**
   * Find tax zone for a location
   */
  async findTaxZoneForLocation(
    country: string,
    state?: string,
    city?: string,
    postalCode?: string,
  ) {
    // Build where clause for zone matching
    const where: any = {
      isActive: true,
      country,
    };

    if (state) {
      where.state = state;
    }

    if (city) {
      where.city = city;
    }

    if (postalCode) {
      where.postalCodes = {
        has: postalCode,
      };
    }

    const zones = await this.prisma.taxZone.findMany({
      where,
      include: {
        rates: {
          where: { isActive: true },
        },
      },
      orderBy: [
        // More specific zones first (city > state > country)
        { city: 'desc' },
        { state: 'desc' },
      ],
    });

    // Return the most specific matching zone
    return zones[0] || null;
  }

  /**
   * Calculate tax for a product/order
   */
  async calculateTax(
    amount: number,
    taxClassId: string,
    location: {
      country: string;
      state?: string;
      city?: string;
      postalCode?: string;
    },
  ): Promise<{
    amount: number;
    tax: number;
    total: number;
    rate: number;
    isInclusive: boolean;
    taxZone?: any;
    taxClass?: any;
  }> {
    // Find tax zone for location
    const taxZone = await this.findTaxZoneForLocation(
      location.country,
      location.state,
      location.city,
      location.postalCode,
    );

    if (!taxZone) {
      // No tax zone found - return zero tax
      return {
        amount,
        tax: 0,
        total: amount,
        rate: 0,
        isInclusive: false,
      };
    }

    // Find tax rate for zone and class
    const taxRate = await this.prisma.taxRate.findFirst({
      where: {
        taxZoneId: taxZone.id,
        taxClassId,
        isActive: true,
      },
      include: {
        taxClass: true,
      },
    });

    if (!taxRate) {
      // No tax rate found - return zero tax
      return {
        amount,
        tax: 0,
        total: amount,
        rate: 0,
        isInclusive: false,
        taxZone,
      };
    }

    const rate = Number(taxRate.rate);
    const isInclusive = taxRate.isInclusive;

    let tax: number;
    let total: number;

    if (isInclusive) {
      // Tax is included in the amount
      // Calculate tax: amount * (rate / (1 + rate))
      tax = amount * (rate / (1 + rate));
      total = amount; // Total is the same as amount (tax included)
    } else {
      // Tax is added to the amount
      tax = amount * rate;
      total = amount + tax;
    }

    return {
      amount,
      tax: Number(tax.toFixed(2)),
      total: Number(total.toFixed(2)),
      rate,
      isInclusive,
      taxZone,
      taxClass: taxRate.taxClass,
    };
  }

  /**
   * Update tax zone
   */
  async updateTaxZone(id: string, updateDto: Partial<CreateTaxZoneDto> | any) {
    await this.findTaxZoneById(id);

    const updateData: any = { ...updateDto };
    
    // Handle both DTO format (countries array) and simple format (individual fields)
    if (updateDto.countries && Array.isArray(updateDto.countries) && updateDto.countries.length > 0) {
      const primaryCountry = updateDto.countries[0];
      const postalCodes = updateDto.countries
        .map((c: any) => c.postalCode)
        .filter(Boolean) as string[];

      updateData.country = primaryCountry?.country;
      updateData.state = primaryCountry?.state;
      updateData.city = primaryCountry?.city;
      updateData.postalCodes = postalCodes.length > 0 ? postalCodes : [];
      delete updateData.countries; // Remove countries from update data
    }

    // Remove undefined values
    Object.keys(updateData).forEach((key) => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    return this.prisma.taxZone.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Update tax class
   */
  async updateTaxClass(id: string, updateDto: Partial<CreateTaxClassDto>) {
    await this.findTaxClassById(id);

    return this.prisma.taxClass.update({
      where: { id },
      data: updateDto,
    });
  }

  /**
   * Update tax rate
   */
  async updateTaxRate(id: string, updateDto: Partial<CreateTaxRateDto>) {
    const rate = await this.prisma.taxRate.findUnique({
      where: { id },
    });

    if (!rate) {
      throw new NotFoundException('Tax rate not found');
    }

    const updateData: any = { ...updateDto };
    if (updateDto.rate !== undefined) {
      updateData.rate = new Decimal(updateDto.rate);
    }

    return this.prisma.taxRate.update({
      where: { id },
      data: updateData,
      include: {
        taxZone: true,
        taxClass: true,
      },
    });
  }

  /**
   * Delete tax zone
   */
  async deleteTaxZone(id: string) {
    await this.findTaxZoneById(id);

    // Check if zone has active tax rates
    const rates = await this.prisma.taxRate.findMany({
      where: { taxZoneId: id, isActive: true },
    });

    if (rates.length > 0) {
      throw new BadRequestException(
        'Cannot delete tax zone with active tax rates',
      );
    }

    return this.prisma.taxZone.delete({
      where: { id },
    });
  }

  /**
   * Delete tax class
   */
  async deleteTaxClass(id: string) {
    await this.findTaxClassById(id);

    // Check if class has active tax rates
    const rates = await this.prisma.taxRate.findMany({
      where: { taxClassId: id, isActive: true },
    });

    if (rates.length > 0) {
      throw new BadRequestException(
        'Cannot delete tax class with active tax rates',
      );
    }

    return this.prisma.taxClass.delete({
      where: { id },
    });
  }

  /**
   * Delete tax rate
   */
  async deleteTaxRate(id: string) {
    const rate = await this.prisma.taxRate.findUnique({
      where: { id },
    });

    if (!rate) {
      throw new NotFoundException('Tax rate not found');
    }

    return this.prisma.taxRate.delete({
      where: { id },
    });
  }
}
