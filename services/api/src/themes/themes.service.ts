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
  description?: string;
  versionString?: string;
  previewImages?: string[];
  metadata?: Record<string, unknown>;
  assets?: unknown;
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

    const data: Record<string, unknown> = {
      version: theme.version + 1,
    };

    if (updateThemeDto.name !== undefined) data.name = updateThemeDto.name;
    if (updateThemeDto.description !== undefined) data.description = updateThemeDto.description;
    if (updateThemeDto.type !== undefined) data.type = updateThemeDto.type;
    if (updateThemeDto.isActive !== undefined) data.isActive = updateThemeDto.isActive;
    if (updateThemeDto.config !== undefined) data.config = updateThemeDto.config as object;

    const updated = await this.prisma.theme.update({
      where: { id },
      data: data as any,
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

    const usageCount = await this.prisma.sellerThemeSettings.count({
      where: { themeId: id },
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        if (usageCount > 0) {
          await tx.sellerThemeSettings.deleteMany({ where: { themeId: id } });
        }
        await tx.seller.updateMany({
          where: { themeId: id },
          data: { themeId: null },
        });
        await tx.theme.delete({ where: { id } });
      });
    } catch (err: any) {
      if (err?.code === 'P2003' || err?.code === 'P2014') {
        throw new BadRequestException(
          `Cannot delete theme "${theme.name}" because it is still referenced by other records. ` +
            'Please reassign sellers first.',
        );
      }
      throw err;
    }
  }

  /** Clone a theme row for admin duplication (inactive copy). */
  async duplicate(id: string): Promise<Theme> {
    const src = await this.prisma.theme.findUnique({
      where: { id },
    });

    if (!src) {
      throw new NotFoundException('Theme not found');
    }

    const copy = await this.prisma.theme.create({
      data: {
        name: `${src.name} (Copy)`,
        type: src.type,
        sellerId: null,
        config: src.config as object,
        isActive: false,
        version: 1,
        versionString: src.versionString,
        description: src.description,
        previewImages: Array.isArray(src.previewImages) ? [...src.previewImages] : [],
        assets: (src.assets as object) ?? undefined,
        metadata: (src.metadata as object) ?? undefined,
        storageUrl: src.storageUrl,
        uploadedBy: src.uploadedBy,
        uploadedAt: src.uploadedAt,
      },
    });

    return this.mapToThemeType(copy);
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

      const typeNorm = String(theme.type).toUpperCase();
      const isMarketplaceSellerTheme = typeNorm === 'SELLER' && theme.sellerId == null;
      const isPlatformHosTheme = typeNorm === 'HOS' && theme.sellerId == null;
      const isOwnSellerTheme =
        theme.sellerId != null &&
        typeof theme.sellerId === 'string' &&
        theme.sellerId === seller.id;

      if (!isMarketplaceSellerTheme && !isPlatformHosTheme && !isOwnSellerTheme) {
        throw new ForbiddenException(
          'This theme cannot be assigned to your store. Use a marketplace seller theme, platform default, or your own theme copy.',
        );
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

    /** Keep Seller.themeId in sync — some flows read this field instead of SellerThemeSettings. */
    await this.prisma.seller.update({
      where: { id: seller.id },
      data: { themeId: themeSettings.themeId },
    });

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
    const typeStr = typeof theme.type === 'string' ? theme.type : String(theme.type ?? '');
    const config =
      theme.config && typeof theme.config === 'object' ? (theme.config as Record<string, unknown>) : {};

    // Flatten config tokens onto the theme object so clients can read colors/typography
    // at the top level (ThemeProvider expects theme.colors.primary).
    return {
      id: theme.id,
      name: theme.name,
      type: typeStr.toLowerCase(),
      sellerId: theme.sellerId || undefined,
      config: theme.config,
      ...config,
      isActive: theme.isActive,
      version: theme.version,
      createdAt: theme.createdAt,
      updatedAt: theme.updatedAt,
      description: theme.description ?? undefined,
      versionString: theme.versionString ?? undefined,
      previewImages: Array.isArray(theme.previewImages) ? theme.previewImages : [],
      metadata: theme.metadata && typeof theme.metadata === 'object' ? theme.metadata : undefined,
      assets: theme.assets ?? undefined,
    } as Theme;
  }
}
