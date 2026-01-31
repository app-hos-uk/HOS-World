import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';
import { UpdateSellerThemeDto } from './dto/update-seller-theme.dto';
import { UpdateCustomerThemePreferenceDto } from './dto/customer-theme-preference.dto';

interface Theme {
  id: string;
  name: string;
  type: string;
  sellerId?: string;
  config: any;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ThemesService {
  constructor(private prisma: PrismaService) {}

  // Theme CRUD Operations
  async create(createThemeDto: CreateThemeDto): Promise<Theme> {
    // Validate seller exists if sellerId provided
    if (createThemeDto.sellerId) {
      const seller = await this.prisma.seller.findUnique({
        where: { userId: createThemeDto.sellerId },
      });

      if (!seller) {
        throw new NotFoundException('Seller not found');
      }

      createThemeDto.sellerId = seller.id;
    }

    const theme = await this.prisma.theme.create({
      data: {
        name: createThemeDto.name,
        type: createThemeDto.type,
        sellerId: createThemeDto.sellerId,
        config: createThemeDto.config as any,
        isActive: createThemeDto.isActive ?? true,
      },
    });

    return this.mapToThemeType(theme);
  }

  async findAll(type?: string, sellerId?: string): Promise<Theme[]> {
    const where: any = {};

    if (type) {
      where.type = type.toUpperCase();
    }

    if (sellerId) {
      const seller = await this.prisma.seller.findUnique({
        where: { userId: sellerId },
      });

      if (!seller) {
        throw new NotFoundException('Seller not found');
      }

      where.sellerId = seller.id;
    }

    const themes = await this.prisma.theme.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return themes.map((theme) => this.mapToThemeType(theme));
  }

  async findOne(id: string): Promise<Theme> {
    const theme = await this.prisma.theme.findUnique({
      where: { id },
    });

    if (!theme) {
      throw new NotFoundException('Theme not found');
    }

    return this.mapToThemeType(theme);
  }

  async update(id: string, updateThemeDto: UpdateThemeDto): Promise<Theme> {
    const theme = await this.prisma.theme.findUnique({
      where: { id },
    });

    if (!theme) {
      throw new NotFoundException('Theme not found');
    }

    const updated = await this.prisma.theme.update({
      where: { id },
      data: {
        ...updateThemeDto,
        config: updateThemeDto.config ? (updateThemeDto.config as any) : undefined,
        version: theme.version + 1,
      },
    });

    return this.mapToThemeType(updated);
  }

  async delete(id: string): Promise<void> {
    const theme = await this.prisma.theme.findUnique({
      where: { id },
    });

    if (!theme) {
      throw new NotFoundException('Theme not found');
    }

    await this.prisma.theme.delete({
      where: { id },
    });
  }

  // Seller Theme Customization
  async getSellerTheme(sellerId: string): Promise<any> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
      include: {
        themeSettings: {
          include: {
            theme: true,
          },
        },
      },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    if (!seller.themeSettings) {
      // Return default HOS theme
      const defaultTheme = await this.prisma.theme.findFirst({
        where: { type: 'HOS', isActive: true },
      });

      return {
        theme: defaultTheme ? this.mapToThemeType(defaultTheme) : null,
        customSettings: null,
      };
    }

    return {
      theme: seller.themeSettings.theme ? this.mapToThemeType(seller.themeSettings.theme) : null,
      customSettings: {
        customLogoUrl: seller.themeSettings.customLogoUrl,
        customFaviconUrl: seller.themeSettings.customFaviconUrl,
        customColors: seller.themeSettings.customColors,
      },
    };
  }

  async updateSellerTheme(sellerId: string, updateDto: UpdateSellerThemeDto): Promise<any> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    // Validate theme exists if themeId provided
    if (updateDto.themeId) {
      const theme = await this.prisma.theme.findUnique({
        where: { id: updateDto.themeId },
      });

      if (!theme) {
        throw new NotFoundException('Theme not found');
      }

      if (theme.type !== 'SELLER' && theme.sellerId !== seller.id) {
        throw new ForbiddenException('Theme does not belong to this seller');
      }
    }

    // Get or create theme settings
    let themeSettings = await this.prisma.sellerThemeSettings.findUnique({
      where: { sellerId: seller.id },
    });

    if (!themeSettings) {
      themeSettings = await this.prisma.sellerThemeSettings.create({
        data: {
          sellerId: seller.id,
          themeId: updateDto.themeId || (await this.getDefaultThemeId()),
          customLogoUrl: updateDto.customLogoUrl,
          customFaviconUrl: updateDto.customFaviconUrl,
          customColors: updateDto.customColors as any,
        },
      });
    } else {
      themeSettings = await this.prisma.sellerThemeSettings.update({
        where: { sellerId: seller.id },
        data: {
          themeId: updateDto.themeId || themeSettings.themeId,
          customLogoUrl: updateDto.customLogoUrl ?? themeSettings.customLogoUrl,
          customFaviconUrl: updateDto.customFaviconUrl ?? themeSettings.customFaviconUrl,
          customColors: updateDto.customColors
            ? (updateDto.customColors as any)
            : themeSettings.customColors,
        },
      });
    }

    return this.getSellerTheme(sellerId);
  }

  // Customer Theme Preferences
  async getCustomerThemePreference(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { themePreference: true },
    });

    return user?.themePreference || null;
  }

  async updateCustomerThemePreference(
    userId: string,
    updateDto: UpdateCustomerThemePreferenceDto,
  ): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        themePreference: updateDto.themePreference || null,
      },
    });

    // Also update customer profile if exists
    const customer = await this.prisma.customer.findUnique({
      where: { userId },
    });

    if (customer) {
      await this.prisma.customer.update({
        where: { userId },
        data: {
          themePreference: updateDto.themePreference || null,
        },
      });
    }
  }

  // Theme Templates
  async getThemeTemplates(): Promise<Theme[]> {
    const templates = await this.prisma.theme.findMany({
      where: {
        type: 'SELLER',
        sellerId: null, // Template themes don't have sellerId
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    return templates.map((theme) => this.mapToThemeType(theme));
  }

  async createThemeFromTemplate(
    sellerId: string,
    templateId: string,
    name?: string,
  ): Promise<Theme> {
    const seller = await this.prisma.seller.findUnique({
      where: { userId: sellerId },
    });

    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const template = await this.prisma.theme.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.type !== 'SELLER' || template.sellerId) {
      throw new BadRequestException('Not a valid template');
    }

    const newTheme = await this.prisma.theme.create({
      data: {
        name: name || `${template.name} - ${seller.storeName}`,
        type: 'SELLER',
        sellerId: seller.id,
        config: template.config,
        isActive: true,
      },
    });

    // Set as seller's active theme
    await this.updateSellerTheme(sellerId, {
      themeId: newTheme.id,
    });

    return this.mapToThemeType(newTheme);
  }

  // Helper Methods
  private async getDefaultThemeId(): Promise<string> {
    const defaultTheme = await this.prisma.theme.findFirst({
      where: { type: 'HOS', isActive: true },
    });

    if (!defaultTheme) {
      throw new NotFoundException('Default HOS theme not found');
    }

    return defaultTheme.id;
  }

  private mapToThemeType(theme: any): Theme {
    return {
      id: theme.id,
      name: theme.name,
      type: theme.type.toLowerCase(),
      sellerId: theme.sellerId || undefined,
      config: theme.config,
      isActive: theme.isActive,
      version: theme.version,
      createdAt: theme.createdAt,
      updatedAt: theme.updatedAt,
    };
  }
}
