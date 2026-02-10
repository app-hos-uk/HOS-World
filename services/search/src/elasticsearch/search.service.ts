import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { SearchPrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';

export interface SearchResult {
  hits: any[];
  total: number;
  aggregations?: any;
}

@Injectable()
export class ElasticSearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticSearchService.name);
  private readonly indexName = 'products';

  constructor(
    private readonly elasticsearchService: ElasticsearchService,
    private readonly prisma: SearchPrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    // Don't block startup - initialize Elasticsearch in background
    Promise.resolve()
      .then(async () => {
        const elasticsearchNode = this.configService.get<string>('ELASTICSEARCH_NODE');
        if (!this.isElasticsearchConfigured(elasticsearchNode)) {
          this.logger.warn('Elasticsearch not configured - search features will be disabled');
          return;
        }

        try {
          const canConnect = await this.canPingElasticsearch();
          if (!canConnect) {
            this.logger.warn(
              'Elasticsearch is configured but unreachable (ping failed) - search features will be disabled',
            );
            return;
          }

          await Promise.race([
            this.createIndex(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Elasticsearch connection timeout')), 5000),
            ),
          ]);

          if (this.configService.get('SYNC_PRODUCTS_ON_STARTUP') === 'true') {
            await this.syncAllProducts();
          }
        } catch (error: any) {
          this.logger.warn(
            `Elasticsearch initialization failed, search features will be disabled: ${error?.message || 'Unknown error'}`,
          );
        }
      })
      .catch((error: any) => {
        this.logger.error(
          `Elasticsearch initialization error: ${error?.message || 'Unknown error'}`,
        );
      });
  }

  private isElasticsearchConfigured(node?: string | null): boolean {
    if (!node) return false;
    const trimmed = node.trim();
    if (!trimmed) return false;
    if (trimmed === 'http://localhost:9200') return false;
    if (trimmed === 'http://elasticsearch:9200') return false;
    if (trimmed === 'https://elasticsearch:9200') return false;
    return true;
  }

  private async canPingElasticsearch(): Promise<boolean> {
    try {
      await Promise.race([
        this.elasticsearchService.ping(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('ping timeout')), 1500)),
      ]);
      return true;
    } catch {
      return false;
    }
  }

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
                fields: { keyword: { type: 'keyword' } },
              },
              description: { type: 'text', analyzer: 'product_analyzer' },
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
              attributes: {
                type: 'nested',
                properties: {
                  attributeId: { type: 'keyword' },
                  attributeName: { type: 'keyword' },
                  attributeSlug: { type: 'keyword' },
                  value: { type: 'keyword' },
                  textValue: { type: 'text' },
                  numberValue: { type: 'float' },
                  booleanValue: { type: 'boolean' },
                },
              },
            },
          },
        },
      });
      this.logger.log(`Created Elasticsearch index: ${this.indexName}`);
    }
  }

  async indexProduct(product: any): Promise<void> {
    try {
      const productAttributes = await this.prisma.productAttribute.findMany({
        where: { productId: product.id },
        include: {
          attribute: { select: { id: true, name: true, slug: true, type: true } },
          attributeValue: { select: { id: true, value: true, slug: true } },
        },
      });

      const attributes = productAttributes.map((pa) => {
        const attrData: any = {
          attributeId: pa.attributeId,
          attributeName: pa.attribute.name,
          attributeSlug: pa.attribute.slug,
        };

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
      const msg = String(error?.message || 'Unknown error');
      this.logger.error(`Failed to index product ${product.id}: ${msg}`);
    }
  }

  async updateProduct(product: any): Promise<void> {
    try {
      await this.indexProduct(product);
    } catch (error: any) {
      this.logger.error(`Failed to update product ${product.id}: ${error?.message}`);
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.elasticsearchService.delete({
        index: this.indexName,
        id: productId,
      });
      this.logger.debug(`Deleted product from index: ${productId}`);
    } catch (error: any) {
      if (error.meta?.statusCode !== 404) {
        this.logger.error(`Failed to delete product ${productId}: ${error?.message}`);
      }
    }
  }

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
        values?: string[];
        minValue?: number;
        maxValue?: number;
        booleanValue?: boolean;
        textValue?: string;
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
      mustClauses.push({ match_all: {} });
    }

    if (filters.category) filterClauses.push({ term: { category: filters.category } });
    if (filters.categoryId) filterClauses.push({ term: { categoryId: filters.categoryId } });
    if (filters.fandom) filterClauses.push({ term: { fandom: filters.fandom } });
    if (filters.sellerId) filterClauses.push({ term: { sellerId: filters.sellerId } });

    if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
      const rangeFilter: any = {};
      if (filters.minPrice !== undefined) rangeFilter.gte = filters.minPrice;
      if (filters.maxPrice !== undefined) rangeFilter.lte = filters.maxPrice;
      filterClauses.push({ range: { price: rangeFilter } });
    }

    if (filters.minRating !== undefined) {
      filterClauses.push({ range: { averageRating: { gte: filters.minRating } } });
    }

    if (filters.inStock) {
      filterClauses.push({ range: { stock: { gt: 0 } } });
    }

    if (filters.attributes && filters.attributes.length > 0) {
      const attributeFilters = filters.attributes.map((attrFilter) => {
        const nestedMust: any[] = [{ term: { 'attributes.attributeId': attrFilter.attributeId } }];

        if (attrFilter.values && attrFilter.values.length > 0) {
          nestedMust.push({ terms: { 'attributes.value': attrFilter.values } });
        } else if (attrFilter.minValue !== undefined || attrFilter.maxValue !== undefined) {
          const range: any = {};
          if (attrFilter.minValue !== undefined) range.gte = attrFilter.minValue;
          if (attrFilter.maxValue !== undefined) range.lte = attrFilter.maxValue;
          nestedMust.push({ range: { 'attributes.numberValue': range } });
        } else if (attrFilter.booleanValue !== undefined) {
          nestedMust.push({ term: { 'attributes.booleanValue': attrFilter.booleanValue } });
        } else if (attrFilter.textValue) {
          nestedMust.push({ match: { 'attributes.textValue': attrFilter.textValue } });
        }

        return {
          nested: { path: 'attributes', query: { bool: { must: nestedMust } } },
        };
      });

      filterClauses.push({ bool: { must: attributeFilters } });
    }

    filterClauses.push({ term: { isActive: true } });

    const body: any = {
      query: { bool: { must: mustClauses, filter: filterClauses } },
      from,
      size: limit,
      sort: [{ _score: { order: 'desc' } }, { createdAt: { order: 'desc' } }],
      aggs: {
        categories: { terms: { field: 'category', size: 20 } },
        categoryIds: { terms: { field: 'categoryId', size: 20 } },
        fandoms: { terms: { field: 'fandom', size: 20 } },
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
        average_rating: { stats: { field: 'averageRating' } },
        attributes: {
          nested: { path: 'attributes' },
          aggs: {
            by_attribute: {
              terms: { field: 'attributes.attributeId', size: 20 },
              aggs: {
                attribute_name: { terms: { field: 'attributes.attributeName', size: 1 } },
                values: { terms: { field: 'attributes.value', size: 50 } },
                number_stats: { stats: { field: 'attributes.numberValue' } },
                boolean_counts: { terms: { field: 'attributes.booleanValue', size: 2 } },
              },
            },
          },
        },
      },
    };

    try {
      const result = await this.elasticsearchService.search({ index: this.indexName, body });
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
    } catch (error: any) {
      this.logger.error(`Search error: ${error?.message}`);
      throw error;
    }
  }

  async syncAllProducts(): Promise<void> {
    this.logger.log('Starting full product sync to Elasticsearch...');
    let skip = 0;
    const take = 100;

    if (!(await this.canPingElasticsearch())) {
      this.logger.warn('Elasticsearch unreachable - aborting product sync');
      return;
    }

    while (true) {
      const products = await this.prisma.product.findMany({
        skip,
        take,
        include: {
          seller: { select: { id: true, storeName: true, slug: true } },
        },
      });

      if (products.length === 0) break;

      for (const product of products) {
        await this.indexProduct(product);
      }

      skip += take;
      this.logger.log(`Synced ${skip} products...`);
    }

    this.logger.log('Product sync complete!');
  }

  async getSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
    try {
      const result = await this.elasticsearchService.search({
        index: this.indexName,
        body: {
          size: 0,
          suggest: {
            product_suggest: {
              prefix: prefix.toLowerCase(),
              completion: { field: 'name', size: limit },
            },
          },
        },
      });

      const resultAny = result as any;
      const suggestData = resultAny.suggest || resultAny.body?.suggest;
      return suggestData?.product_suggest?.[0]?.options?.map((option: any) => option.text) || [];
    } catch (error: any) {
      this.logger.error(`Suggestion error: ${error?.message}`);
      return [];
    }
  }
}
