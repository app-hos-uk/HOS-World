import {
  Controller,
  Post,
  Get,
  UseGuards,
  Logger,
  ForbiddenException,
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { slugify } from '@hos-marketplace/utils';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('admin/migration-taxonomy-data')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class MigrationTaxonomyDataController {
  private readonly logger = new Logger(MigrationTaxonomyDataController.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  private checkMigrationsEnabled(): void {
    const enabled = this.configService.get<string>('ENABLE_ADMIN_MIGRATIONS') === 'true';
    if (!enabled) {
      this.logger.warn('Admin migration endpoint called but ENABLE_ADMIN_MIGRATIONS is not set to "true"');
      throw new ForbiddenException('Admin migrations are disabled in production. Set ENABLE_ADMIN_MIGRATIONS=true to enable.');
    }
  }

  @Post('migrate')
  @ApiOperation({ summary: 'Migrate taxonomy data', description: 'Migrates existing category strings and tag arrays to new taxonomy system. Requires ENABLE_ADMIN_MIGRATIONS=true. Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Data migration completed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required or migrations disabled' })
  async migrateData(): Promise<ApiResponse<any>> {
    this.checkMigrationsEnabled();
    
    try {
      this.logger.log('🔄 Starting taxonomy data migration...');

      const results = {
        categoriesCreated: 0,
        categoriesLinked: 0,
        tagsCreated: 0,
        tagsLinked: 0,
        errors: [] as string[],
      };

      // Step 1: Migrate category strings to Category model
      try {
        const productsWithCategories = await this.prisma.product.findMany({
          where: {
            category: { not: null },
          },
          select: {
            id: true,
            category: true,
          },
          distinct: ['category'],
        });

        this.logger.log(`Found ${productsWithCategories.length} unique category strings`);

        const categoryMap = new Map<string, string>(); // category string -> category ID

        for (const product of productsWithCategories) {
          if (!product.category) continue;

          // Check if category already exists
          let category = await this.prisma.category.findFirst({
            where: {
              name: product.category,
              level: 0, // Root level for migrated categories
            },
          });

          if (!category) {
            // Create new category
            const categorySlug = slugify(product.category);
            let finalSlug = categorySlug;
            let counter = 1;

            while (await this.prisma.category.findUnique({ where: { slug: finalSlug } })) {
              finalSlug = `${categorySlug}-${counter}`;
              counter++;
            }

            category = await this.prisma.category.create({
              data: {
                name: product.category,
                slug: finalSlug,
                level: 0,
                path: `/${finalSlug}`,
                isActive: true,
              },
            });

            results.categoriesCreated++;
            this.logger.log(`Created category: ${category.name} (${category.id})`);
          }

          categoryMap.set(product.category, category.id);
        }

        // Step 2: Link products to categories
        for (const [categoryString, categoryId] of categoryMap.entries()) {
          const updateResult = await this.prisma.product.updateMany({
            where: {
              category: categoryString,
            },
            data: {
              categoryId: categoryId,
            },
          });

          results.categoriesLinked += updateResult.count;
        }

        this.logger.log(`Linked ${results.categoriesLinked} products to categories`);
      } catch (error: any) {
        const errorMsg = `Category migration failed: ${error.message}`;
        this.logger.error(errorMsg);
        results.errors.push(errorMsg);
      }

      // Step 3: Migrate tag arrays to Tag model
      try {
        const productsWithTags = await this.prisma.product.findMany({
          where: {
            tags: { isEmpty: false },
          },
          select: {
            id: true,
            tags: true,
          },
        });

        this.logger.log(`Found ${productsWithTags.length} products with tags`);

        const tagMap = new Map<string, string>(); // tag name -> tag ID
        const allUniqueTags = new Set<string>();

        // Collect all unique tags
        for (const product of productsWithTags) {
          if (product.tags && Array.isArray(product.tags)) {
            for (const tag of product.tags) {
              if (tag && typeof tag === 'string') {
                allUniqueTags.add(tag);
              }
            }
          }
        }

        this.logger.log(`Found ${allUniqueTags.size} unique tags`);

        // Create tags
        for (const tagName of allUniqueTags) {
          // Check if tag already exists
          let tag = await this.prisma.tag.findFirst({
            where: {
              name: tagName,
            },
          });

          if (!tag) {
            const tagSlug = slugify(tagName);
            let finalSlug = tagSlug;
            let counter = 1;

            while (await this.prisma.tag.findUnique({ where: { slug: finalSlug } })) {
              finalSlug = `${tagSlug}-${counter}`;
              counter++;
            }

            tag = await this.prisma.tag.create({
              data: {
                name: tagName,
                slug: finalSlug,
                category: 'CUSTOM', // Default category for migrated tags
                isActive: true,
              },
            });

            results.tagsCreated++;
            this.logger.log(`Created tag: ${tag.name} (${tag.id})`);
          }

          tagMap.set(tagName, tag.id);
        }

        // Step 4: Link products to tags
        for (const product of productsWithTags) {
          if (!product.tags || !Array.isArray(product.tags)) continue;

          const tagIds: string[] = [];
          for (const tagName of product.tags) {
            if (tagName && typeof tagName === 'string' && tagMap.has(tagName)) {
              tagIds.push(tagMap.get(tagName)!);
            }
          }

          if (tagIds.length > 0) {
            // Delete existing product tags
            await this.prisma.productTag.deleteMany({
              where: { productId: product.id },
            });

            // Create new product tags
            await this.prisma.productTag.createMany({
              data: tagIds.map(tagId => ({
                productId: product.id,
                tagId: tagId,
              })),
              skipDuplicates: true,
            });

            results.tagsLinked++;
          }
        }

        this.logger.log(`Linked ${results.tagsLinked} products to tags`);
      } catch (error: any) {
        const errorMsg = `Tag migration failed: ${error.message}`;
        this.logger.error(errorMsg);
        results.errors.push(errorMsg);
      }

      const success = results.errors.length === 0;

      this.logger.log(
        `✅ Data migration completed: ${results.categoriesCreated} categories, ${results.tagsCreated} tags created, ${results.categoriesLinked} products linked to categories, ${results.tagsLinked} products linked to tags`,
      );

      return {
        data: {
          success,
          message: success
            ? 'Data migration completed successfully'
            : `Data migration completed with ${results.errors.length} errors`,
          results,
        },
        message: success
          ? 'Data migration completed successfully'
          : `Data migration completed with ${results.errors.length} errors`,
      };
    } catch (error: any) {
      this.logger.error('❌ Data migration failed:', error.message);
      return {
        data: null,
        message: 'Data migration failed',
        error: error.message,
      };
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Get taxonomy migration status', description: 'Retrieves the status of taxonomy data migration. Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Migration status retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getMigrationStatus(): Promise<ApiResponse<any>> {
    try {
      // Count products with old category strings
      const productsWithOldCategory = await this.prisma.product.count({
        where: {
          category: { not: null },
          categoryId: null,
        },
      });

      // Count products with old tags arrays
      const productsWithOldTags = await this.prisma.product.count({
        where: {
          tags: { isEmpty: false },
        },
      });

      // Count products linked to new categories
      const productsWithNewCategory = await this.prisma.product.count({
        where: {
          categoryId: { not: null },
        },
      });

      // Count products linked to new tags (using groupBy to get distinct count)
      const productTags = await this.prisma.productTag.groupBy({
        by: ['productId'],
      });
      const productsWithNewTags = productTags.length;

      // Count categories and tags
      const categoryCount = await this.prisma.category.count();
      const tagCount = await this.prisma.tag.count();

      return {
        data: {
          oldData: {
            productsWithCategoryString: productsWithOldCategory,
            productsWithTagArray: productsWithOldTags,
          },
          newData: {
            categoriesCreated: categoryCount,
            tagsCreated: tagCount,
            productsLinkedToCategories: productsWithNewCategory,
            productsLinkedToTags: productsWithNewTags,
          },
          migrationNeeded: productsWithOldCategory > 0 || productsWithOldTags > 0,
        },
        message: 'Migration status retrieved successfully',
      };
    } catch (error: any) {
      this.logger.error('❌ Failed to get migration status:', error.message);
      return {
        data: null,
        message: 'Failed to get migration status',
        error: error.message,
      };
    }
  }
}

