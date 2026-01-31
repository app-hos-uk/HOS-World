import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface SearchResult {
  hits: any[];
  total: number;
  aggregations?: any;
}

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly indexName = 'products';

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Don't block startup - initialize Elasticsearch in background
    // Return immediately so NestJS doesn't wait
    Promise.resolve()
      .then(async () => {
        // Only initialize Elasticsearch if configured
        const elasticsearchNode = this.configService.get<string>('ELASTICSEARCH_NODE');
        if (!this.isElasticsearchConfigured(elasticsearchNode)) {
          this.logger.warn('Elasticsearch not configured - search features will be disabled');
          return;
        }

        try {
          // Verify connectivity first. If we can't ping quickly, treat as disabled to avoid log spam.
          const canConnect = await this.canPingElasticsearch();
          if (!canConnect) {
            this.logger.warn(
              'Elasticsearch is configured but unreachable (ping failed) - search features will be disabled',
              'SearchService',
            );
            return;
          }

          // Set a timeout for Elasticsearch connection
          await Promise.race([
            this.createIndex(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Elasticsearch connection timeout')), 5000),
            ),
          ]);

          // Optionally sync existing products on startup
          if (this.configService.get('SYNC_PRODUCTS_ON_STARTUP') === 'true') {
            await this.syncAllProducts();
          }
        } catch (error) {
          this.logger.warn(
            `Elasticsearch initialization failed, search features will be disabled: ${error?.message || 'Unknown error'}`,
            'SearchService',
          );
          this.logger.debug(error?.stack, 'SearchService');
          // Don't throw - allow app to start without Elasticsearch
        }
      })
      .catch((error: any) => {
        this.logger.error(
          `Elasticsearch initialization error: ${error?.message || 'Unknown error'}`,
          'SearchService',
        );
        this.logger.debug(error?.stack, 'SearchService');
      });
    // Return immediately - don't wait for Elasticsearch
  }

  private isElasticsearchConfigured(node?: string | null): boolean {
    if (!node) return false;
    const trimmed = node.trim();
    if (!trimmed) return false;

    // Common docker-compose placeholder values that should not be treated as “configured” in production.
    if (trimmed === 'http://localhost:9200') return false;
    if (trimmed === 'http://elasticsearch:9200') return false;
    if (trimmed === 'https://elasticsearch:9200') return false;
    return true;
  }

  private async canPingElasticsearch(): Promise<boolean> {
    try {
      // Keep this fast — we only need a yes/no to avoid triggering a large sync.
      await Promise.race([
        this.elasticsearchService.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 1500)),
      ]);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create Elasticsearch index with proper mappings
   */
  async createIndex(): Promise<void> {
    const exists = await this.elasticsearchService.indices.exists({
      index: this.indexName,
    });

    if (!exists) {
      await this.elasticsearchService.indices.create({
        index: this.indexName,
        body: {
          settings: {
            analysis: {
              analyzer: {
                product_analyzer: {
                  type: 'custom',
                  tokenizer: 'standard',
                  filter: ['lowercase', 'asciifolding'],
                },
              },
            },
          },
          mappings: {
            properties: {
              id: { type: 'keyword' },
              name: {
                type: 'text',
                analyzer: 'product_analyzer',
                fields: {
                  keyword: { type: 'keyword' },
                },
              },
              description: {
                type: 'text',
                analyzer: 'product_analyzer',
              },
              category: { type: 'keyword' },
              categoryId: { type: 'keyword' },
              fandom: { type: 'keyword' },
              sellerId: { type: 'keyword' },
              sellerName: { type: 'keyword' },
              sellerSlug: { type: 'keyword' },
              price: { type: 'float' },
              stock: { type: 'integer' },
              isActive: { type: 'boolean' },
              tags: { type: 'keyword' },
              averageRating: { type: 'float' },
              reviewCount: { type: 'integer' },
              createdAt: { type: 'date' },
              updatedAt: { type: 'date' },
              // Attributes for faceted search (nested structure)
              attributes: {
                type: 'nested',
                properties: {
                  attributeId: { type: 'keyword' },
                  attributeName: { type: 'keyword' },
                  attributeSlug: { type: 'keyword' },
                  value: { type: 'keyword' }, // For SELECT type attributes (slug from AttributeValue)
                  textValue: { type: 'text' }, // For TEXT type attributes
                  numberValue: { type: 'float' }, // For NUMBER type attributes
                  booleanValue: { type: 'boolean' }, // For BOOLEAN type attributes
                },
              },
            },
          },
        },
      });
      this.logger.log(`Created Elasticsearch index: ${this.indexName}`);
    }
  }

  /**
   * Index a single product
   */
  async indexProduct(product: any): Promise<void> {
    try {
      // Fetch product attributes for indexing
      const productAttributes = await this.prisma.productAttribute.findMany({
        where: { productId: product.id },
        include: {
          attribute: {
            select: {
              id: true,
              name: true,
              slug: true,
              type: true,
            },
          },
          attributeValue: {
            select: {
              id: true,
              value: true,
              slug: true,
            },
          },
        },
      });

      // Transform attributes for Elasticsearch nested structure
      const attributes = productAttributes.map((pa) => {
        const attrData: any = {
          attributeId: pa.attributeId,
          attributeName: pa.attribute.name,
          attributeSlug: pa.attribute.slug,
        };

        // Map value based on attribute type
        if (pa.attribute.type === 'SELECT' && pa.attributeValue) {
          attrData.value = pa.attributeValue.slug;
        } else if (pa.textValue !== null) {
          attrData.textValue = pa.textValue;
        } else if (pa.numberValue !== null) {
          attrData.numberValue = parseFloat(pa.numberValue.toString());
        } else if (pa.booleanValue !== null) {
          attrData.booleanValue = pa.booleanValue;
        }

        return attrData;
      });

      await this.elasticsearchService.index({
        index: this.indexName,
        id: product.id,
        body: {
          id: product.id,
          name: product.name,
          description: product.description || '',
          category: product.category || null,
          categoryId: product.categoryId || null,
          fandom: product.fandom || null,
          sellerId: product.sellerId,
          sellerName: product.seller?.storeName || null,
          sellerSlug: product.seller?.slug || null,
          price: parseFloat(product.price || '0'),
          stock: product.stock || 0,
          isActive: product.status === 'ACTIVE',
          tags: product.tags || [],
          averageRating: product.averageRating || 0,
          reviewCount: product.reviewCount || 0,
          attributes: attributes.length > 0 ? attributes : [],
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
      });
      this.logger.debug(`Indexed product: ${product.id} with ${attributes.length} attributes`);
    } catch (error: any) {
      // Avoid log spam during outages; keep one error line with message + product id.
      const msg = String(error?.message || 'Unknown error');
      this.logger.error(`Failed to index product ${product.id}: ${msg}`);
    }
  }

  /**
   * Update indexed product
   */
  async updateProduct(product: any): Promise<void> {
    try {
      // Re-index the product to include updated attributes
      await this.indexProduct(product);
      this.logger.debug(`Updated indexed product: ${product.id}`);
    } catch (error) {
      this.logger.error(`Failed to update product ${product.id}:`, error);
    }
  }

  /**
   * Delete product from index
   */
  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.elasticsearchService.delete({
        index: this.indexName,
        id: productId,
      });
      this.logger.debug(`Deleted product from index: ${productId}`);
    } catch (error) {
      // Ignore if product doesn't exist in index
      if (error.meta?.statusCode !== 404) {
        this.logger.error(`Failed to delete product ${productId}:`, error);
      }
    }
  }

  /**
   * Search products with filters
   */
  async search(
    query: string,
    filters: {
      category?: string;
      categoryId?: string;
      fandom?: string;
      sellerId?: string;
      minPrice?: number;
      maxPrice?: number;
      minRating?: number;
      inStock?: boolean;
      attributes?: Array<{
        attributeId: string;
        values?: string[]; // For SELECT type (attribute value slugs)
        minValue?: number; // For NUMBER type
        maxValue?: number; // For NUMBER type
        booleanValue?: boolean; // For BOOLEAN type
        textValue?: string; // For TEXT type (partial match)
      }>;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<SearchResult> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const from = (page - 1) * limit;

    const mustClauses: any[] = [];
    const filterClauses: any[] = [];

    // Text search query
    if (query && query.trim()) {
      mustClauses.push({
        multi_match: {
          query: query.trim(),
          fields: ['name^3', 'description^2', 'tags'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    } else {
      // Match all if no query
      mustClauses.push({ match_all: {} });
    }

    // Filters
    if (filters.category) {
      filterClauses.push({ term: { category: filters.category } });
    }

    if (filters.categoryId) {
      filterClauses.push({ term: { categoryId: filters.categoryId } });
    }

    if (filters.fandom) {
      filterClauses.push({ term: { fandom: filters.fandom } });
    }

    if (filters.sellerId) {
      filterClauses.push({ term: { sellerId: filters.sellerId } });
    }

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const rangeFilter: any = {};
      if (filters.minPrice !== undefined) {
        rangeFilter.gte = filters.minPrice;
      }
      if (filters.maxPrice !== undefined) {
        rangeFilter.lte = filters.maxPrice;
      }
      filterClauses.push({ range: { price: rangeFilter } });
    }

    if (filters.minRating !== undefined) {
      filterClauses.push({ range: { averageRating: { gte: filters.minRating } } });
    }

    if (filters.inStock) {
      filterClauses.push({ range: { stock: { gt: 0 } } });
    }

    // Attribute-based filters (nested queries)
    if (filters.attributes && filters.attributes.length > 0) {
      const attributeFilters = filters.attributes.map((attrFilter) => {
        const nestedQuery: any = {
          nested: {
            path: 'attributes',
            query: {
              bool: {
                must: [{ term: { 'attributes.attributeId': attrFilter.attributeId } }],
              },
            },
          },
        };

        // Add value filters based on attribute type
        const mustClauses: any[] = [{ term: { 'attributes.attributeId': attrFilter.attributeId } }];

        if (attrFilter.values && attrFilter.values.length > 0) {
          // SELECT type - filter by value slugs
          mustClauses.push({
            terms: { 'attributes.value': attrFilter.values },
          });
        } else if (attrFilter.minValue !== undefined || attrFilter.maxValue !== undefined) {
          // NUMBER type - range filter
          const range: any = {};
          if (attrFilter.minValue !== undefined) range.gte = attrFilter.minValue;
          if (attrFilter.maxValue !== undefined) range.lte = attrFilter.maxValue;
          mustClauses.push({ range: { 'attributes.numberValue': range } });
        } else if (attrFilter.booleanValue !== undefined) {
          // BOOLEAN type
          mustClauses.push({ term: { 'attributes.booleanValue': attrFilter.booleanValue } });
        } else if (attrFilter.textValue) {
          // TEXT type - partial match
          mustClauses.push({
            match: { 'attributes.textValue': attrFilter.textValue },
          });
        }

        return {
          nested: {
            path: 'attributes',
            query: {
              bool: {
                must: mustClauses,
              },
            },
          },
        };
      });

      // All attribute filters must match (AND logic)
      filterClauses.push({
        bool: {
          must: attributeFilters,
        },
      });
    }

    // Always filter active products
    filterClauses.push({ term: { isActive: true } });

    const body: any = {
      query: {
        bool: {
          must: mustClauses,
          filter: filterClauses,
        },
      },
      from,
      size: limit,
      sort: [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }],
      aggs: {
        categories: {
          terms: { field: 'category', size: 20 },
        },
        categoryIds: {
          terms: { field: 'categoryId', size: 20 },
        },
        fandoms: {
          terms: { field: 'fandom', size: 20 },
        },
        price_ranges: {
          range: {
            field: 'price',
            ranges: [
              { to: 10 },
              { from: 10, to: 25 },
              { from: 25, to: 50 },
              { from: 50, to: 100 },
              { from: 100 },
            ],
          },
        },
        average_rating: {
          stats: { field: 'averageRating' },
        },
        // Attribute-based aggregations (nested)
        attributes: {
          nested: { path: 'attributes' },
          aggs: {
            by_attribute: {
              terms: { field: 'attributes.attributeId', size: 20 },
              aggs: {
                attribute_name: {
                  terms: { field: 'attributes.attributeName', size: 1 },
                },
                values: {
                  terms: { field: 'attributes.value', size: 50 }, // For SELECT type attributes
                },
                number_stats: {
                  stats: { field: 'attributes.numberValue' }, // For NUMBER type attributes
                },
                boolean_counts: {
                  terms: { field: 'attributes.booleanValue', size: 2 }, // For BOOLEAN type attributes
                },
              },
            },
          },
        },
      },
    };

    try {
      const result = await this.elasticsearchService.search({
        index: this.indexName,
        body,
      });

      // Elasticsearch v8+ returns result directly, not in .body
      // Type assertion to handle both old and new API formats
      const resultAny = result as any;
      const hits = (resultAny.hits?.hits || resultAny.body?.hits?.hits || []).map((hit: any) => ({
        ...(hit._source || hit.source || {}),
        score: hit._score || hit.score || 0,
      }));

      const totalHits = resultAny.hits?.total || resultAny.body?.hits?.total;
      const total = typeof totalHits === 'object' ? totalHits.value || totalHits : totalHits;

      return {
        hits,
        total: total || 0,
        aggregations: resultAny.aggregations || resultAny.body?.aggregations || {},
      };
    } catch (error) {
      this.logger.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Sync all products from database to Elasticsearch
   */
  async syncAllProducts(): Promise<void> {
    this.logger.log('Starting full product sync to Elasticsearch...');
    let skip = 0;
    const take = 100;

    // If the cluster is unreachable, stop early to prevent log spam.
    if (!(await this.canPingElasticsearch())) {
      this.logger.warn('Elasticsearch unreachable - aborting product sync', 'SearchService');
      return;
    }

    while (true) {
      const products = await this.prisma.product.findMany({
        skip,
        take,
        include: {
          seller: {
            select: {
              id: true,
              storeName: true,
              slug: true,
            },
          },
        },
      });

      if (products.length === 0) {
        break;
      }

      for (const product of products) {
        await this.indexProduct(product);
      }

      skip += take;
      this.logger.log(`Synced ${skip} products...`);
    }

    this.logger.log('Product sync complete!');
  }

  /**
   * Get search suggestions/autocomplete
   */
  async getSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
    try {
      const result = await this.elasticsearchService.search({
        index: this.indexName,
        body: {
          size: 0,
          suggest: {
            product_suggest: {
              prefix: prefix.toLowerCase(),
              completion: {
                field: 'name',
                size: limit,
              },
            },
          },
        },
      });

      const resultAny = result as any;
      const suggestData = resultAny.suggest || resultAny.body?.suggest;
      const suggestions =
        suggestData?.product_suggest?.[0]?.options?.map((option: any) => option.text) || [];

      return suggestions;
    } catch (error) {
      this.logger.error('Suggestion error:', error);
      return [];
    }
  }
}
