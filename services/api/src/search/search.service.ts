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
    Promise.resolve().then(async () => {
      // Only initialize Elasticsearch if configured
      const elasticsearchNode = this.configService.get<string>('ELASTICSEARCH_NODE');
      if (!elasticsearchNode) {
        this.logger.warn('ELASTICSEARCH_NODE not configured - search features will be disabled');
        return;
      }

      try {
        // Set a timeout for Elasticsearch connection
        await Promise.race([
          this.createIndex(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Elasticsearch connection timeout')), 5000)
          ),
        ]);
        
        // Optionally sync existing products on startup
        if (this.configService.get('SYNC_PRODUCTS_ON_STARTUP') === 'true') {
          await this.syncAllProducts();
        }
      } catch (error) {
        this.logger.warn(`Elasticsearch initialization failed, search features will be disabled: ${error?.message || 'Unknown error'}`, 'SearchService');
        this.logger.debug(error?.stack, 'SearchService');
        // Don't throw - allow app to start without Elasticsearch
      }
    }).catch((error: any) => {
      this.logger.error(`Elasticsearch initialization error: ${error?.message || 'Unknown error'}`, 'SearchService');
      this.logger.debug(error?.stack, 'SearchService');
    });
    // Return immediately - don't wait for Elasticsearch
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
      await this.elasticsearchService.index({
        index: this.indexName,
        id: product.id,
        body: {
          id: product.id,
          name: product.name,
          description: product.description || '',
          category: product.category || null,
          fandom: product.fandom || null,
          sellerId: product.sellerId,
          sellerName: product.seller?.storeName || null,
          sellerSlug: product.seller?.slug || null,
          price: parseFloat(product.price || '0'),
          stock: product.stock || 0,
          isActive: product.isActive,
          tags: product.tags || [],
          averageRating: product.averageRating || 0,
          reviewCount: product.reviewCount || 0,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        },
      });
      this.logger.debug(`Indexed product: ${product.id}`);
    } catch (error) {
      this.logger.error(`Failed to index product ${product.id}:`, error);
    }
  }

  /**
   * Update indexed product
   */
  async updateProduct(product: any): Promise<void> {
    try {
      await this.elasticsearchService.update({
        index: this.indexName,
        id: product.id,
        body: {
          doc: {
            name: product.name,
            description: product.description || '',
            category: product.category || null,
            fandom: product.fandom || null,
            price: parseFloat(product.price || '0'),
            stock: product.stock || 0,
            isActive: product.isActive,
            tags: product.tags || [],
            averageRating: product.averageRating || 0,
            reviewCount: product.reviewCount || 0,
            updatedAt: product.updatedAt,
          },
        },
      });
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
      fandom?: string;
      sellerId?: string;
      minPrice?: number;
      maxPrice?: number;
      minRating?: number;
      inStock?: boolean;
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
      sort: [
        { _score: { order: 'desc' } },
        { createdAt: { order: 'desc' } },
      ],
      aggs: {
        categories: {
          terms: { field: 'category', size: 20 },
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
      },
    };

    try {
      const result = await this.elasticsearchService.search({
        index: this.indexName,
        body,
      });

      const hits = result.body.hits.hits.map((hit: any) => ({
        ...hit._source,
        score: hit._score,
      }));

      return {
        hits,
        total: result.body.hits.total.value || result.body.hits.total,
        aggregations: result.body.aggregations,
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

    while (true) {
      const products = await this.prisma.product.findMany({
        skip,
        take,
        include: {
          seller: true,
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

      const suggestions =
        result.body.suggest?.product_suggest?.[0]?.options?.map(
          (option: any) => option.text,
        ) || [];

      return suggestions;
    } catch (error) {
      this.logger.error('Suggestion error:', error);
      return [];
    }
  }
}

