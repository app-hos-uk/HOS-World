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

    // If preview images already exist, return them
    if (theme.previewImages && Array.isArray(theme.previewImages) && theme.previewImages.length > 0) {
      return theme.previewImages as string[];
    }

    // Generate preview images from theme assets
    // Strategy:
    // 1. Extract theme assets from storage
    // 2. Create a preview HTML file with the theme applied
    // 3. Generate screenshots (if headless browser available) or use placeholder images
    // 4. Upload preview images to storage
    // 5. Update theme record with preview image URLs

    try {
      const previewImages: string[] = [];
      
      // If theme has assets, try to generate previews
      const assets = theme.assets as any;
      
      if (assets && (assets.images || assets.css || assets.js)) {
        // Extract first few images from theme assets as previews
        if (assets.images && Array.isArray(assets.images) && assets.images.length > 0) {
          // Use first 3 images as previews
          const imageAssets = assets.images.slice(0, 3);
          
          for (const imagePath of imageAssets) {
            try {
              // If storageUrl exists, try to construct preview URL
              if (theme.storageUrl) {
                // For now, use the image paths directly
                // In production, you would:
                // 1. Download the image from storage
                // 2. Resize/optimize it for preview
                // 3. Upload the preview version
                // 4. Return the preview URL
                
                // Construct preview URL (assuming images are in the theme package)
                const previewUrl = `${theme.storageUrl}/${imagePath}`;
                previewImages.push(previewUrl);
              }
            } catch (error) {
              // Skip images that can't be processed
              console.warn(`Failed to process preview image: ${imagePath}`, error);
            }
          }
        }
        
        // If no images found, create a placeholder preview
        if (previewImages.length === 0) {
          // Generate a placeholder preview image
          // In production, you could use a library like canvas or sharp to create a preview
          const placeholderUrl = await this.createPlaceholderPreview(theme);
          if (placeholderUrl) {
            previewImages.push(placeholderUrl);
          }
        }
      } else {
        // No assets available, create a simple placeholder
        const placeholderUrl = await this.createPlaceholderPreview(theme);
        if (placeholderUrl) {
          previewImages.push(placeholderUrl);
        }
      }
      
      // Update theme with preview images
      if (previewImages.length > 0) {
        await this.prisma.theme.update({
          where: { id: themeId },
          data: {
            previewImages: previewImages as any,
          },
        });
      }
      
      return previewImages;
    } catch (error: any) {
      // If preview generation fails, return empty array or existing previews
      console.error('Failed to generate preview images:', error);
      return theme.previewImages ? (theme.previewImages as string[]) : [];
    }
  }
  
  private async createPlaceholderPreview(theme: any): Promise<string | null> {
    try {
      // Create a simple placeholder image
      // In production, you could:
      // 1. Use canvas to create an image with theme name
      // 2. Use a screenshot service
      // 3. Use a template preview generator
      
      // For now, return null (no placeholder generated)
      // In production, implement actual preview generation:
      // const canvas = createCanvas(800, 600);
      // const ctx = canvas.getContext('2d');
      // // Draw theme preview
      // const buffer = canvas.toBuffer('image/png');
      // const file = { buffer, originalname: `preview-${theme.id}.png`, mimetype: 'image/png' };
      // const result = await this.storageService.uploadFile(file, 'themes/previews');
      // return result.url;
      
      return null;
    } catch (error) {
      console.error('Failed to create placeholder preview:', error);
      return null;
    }
  }
}

