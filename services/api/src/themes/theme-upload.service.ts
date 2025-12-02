import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { StorageService } from '../storage/storage.service';
import * as AdmZip from 'adm-zip';

interface ThemePackage {
  name: string;
  version: string;
  description?: string;
  previewImages: string[];
  config: any;
  assets: {
    css: string[];
    js: string[];
    images: string[];
    fonts: string[];
  };
  metadata: {
    author?: string;
    tags?: string[];
    compatibility?: string;
  };
}

@Injectable()
export class ThemeUploadService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
  ) {}

  async uploadTheme(
    file: Express.Multer.File,
    userId: string,
    metadata?: { name?: string; description?: string },
  ) {
    if (!file) {
      throw new BadRequestException('No theme file provided');
    }

    if (!file.originalname.endsWith('.zip')) {
      throw new BadRequestException('Theme must be a ZIP file');
    }

    // Extract ZIP file
    const zip = new AdmZip(file.buffer);
    const entries = zip.getEntries();

    // Validate theme structure
    const themePackage = await this.validateThemePackage(zip, entries);

    // Extract assets
    const extractedAssets = await this.extractAssets(zip, entries);

    // Upload theme package to storage
    const storageResult = await this.storageService.uploadFile(
      file,
      'themes',
      { optimize: false },
    );

    // Create theme record
    const theme = await this.prisma.theme.create({
      data: {
        name: metadata?.name || themePackage.name,
        type: 'SELLER',
        description: metadata?.description || themePackage.description,
        versionString: themePackage.version,
        config: themePackage.config,
        assets: extractedAssets,
        metadata: themePackage.metadata,
        storageUrl: storageResult.url,
        previewImages: themePackage.previewImages,
        uploadedBy: userId,
        uploadedAt: new Date(),
        isActive: false, // Require admin activation
      },
    });

    return theme;
  }

  private async validateThemePackage(
    zip: AdmZip,
    entries: AdmZip.IZipEntry[],
  ): Promise<ThemePackage> {
    // Check for theme.json or package.json
    const themeJson = entries.find((e) => e.entryName === 'theme.json');
    const packageJson = entries.find((e) => e.entryName === 'package.json');

    if (!themeJson && !packageJson) {
      throw new BadRequestException('Theme package must contain theme.json or package.json');
    }

    const configContent = themeJson
      ? zip.readAsText(themeJson)
      : zip.readAsText(packageJson!);

    let themeConfig: any;
    try {
      themeConfig = JSON.parse(configContent);
    } catch (error) {
      throw new BadRequestException('Invalid theme.json or package.json format');
    }

    // Validate required fields
    if (!themeConfig.name) {
      throw new BadRequestException('Theme name is required');
    }

    if (!themeConfig.version) {
      throw new BadRequestException('Theme version is required');
    }

    return {
      name: themeConfig.name,
      version: themeConfig.version,
      description: themeConfig.description,
      previewImages: themeConfig.previewImages || [],
      config: themeConfig.config || {},
      assets: {
        css: themeConfig.assets?.css || [],
        js: themeConfig.assets?.js || [],
        images: themeConfig.assets?.images || [],
        fonts: themeConfig.assets?.fonts || [],
      },
      metadata: {
        author: themeConfig.metadata?.author,
        tags: themeConfig.metadata?.tags || [],
        compatibility: themeConfig.metadata?.compatibility,
      },
    };
  }

  private async extractAssets(
    zip: AdmZip,
    entries: AdmZip.IZipEntry[],
  ): Promise<any> {
    const assets: any = {
      css: [],
      js: [],
      images: [],
      fonts: [],
    };

    // Extract CSS files
    entries
      .filter((e) => e.entryName.endsWith('.css'))
      .forEach((entry) => {
        assets.css.push(entry.entryName);
      });

    // Extract JS files
    entries
      .filter((e) => e.entryName.endsWith('.js'))
      .forEach((entry) => {
        assets.js.push(entry.entryName);
      });

    // Extract image files
    entries
      .filter((e) =>
        ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].some((ext) =>
          e.entryName.endsWith(ext),
        ),
      )
      .forEach((entry) => {
        assets.images.push(entry.entryName);
      });

    // Extract font files
    entries
      .filter((e) =>
        ['.woff', '.woff2', '.ttf', '.otf', '.eot'].some((ext) =>
          e.entryName.endsWith(ext),
        ),
      )
      .forEach((entry) => {
        assets.fonts.push(entry.entryName);
      });

    return assets;
  }

  async generatePreview(themeId: string): Promise<string[]> {
    const theme = await this.prisma.theme.findUnique({
      where: { id: themeId },
    });

    if (!theme) {
      throw new BadRequestException('Theme not found');
    }

    // TODO: Generate preview images from theme assets
    // This could involve rendering the theme and taking screenshots

    return theme.previewImages || [];
  }
}

