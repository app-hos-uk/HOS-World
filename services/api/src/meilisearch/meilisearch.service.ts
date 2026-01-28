import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { MeiliSearch, Index, SearchParams, SearchResponse, Settings } from 'meilisearch';

export interface MeiliSearchResult {
  hits: any[];
  total: number;
  processingTimeMs: number;
  facetDistribution?: Record<string, Record<string, number>>;
  query: string;
}

export interface SearchFilters {
  category?: string;
  categoryId?: string;
  fandom?: string;
  sellerId?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  tags?: string[];
  attributes?: Record<string, string[]>;
  page?: number;
  limit?: number;
  sort?: string;
}

@Injectable()
export class MeilisearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MeilisearchService.name);
  private client: MeiliSearch | null = null;
  private productsIndex: Index | null = null;
  private readonly indexName = 'products';
  private isConfigured = false;
  private indexingQueue: any[] = [];
  private indexingTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 100;
  private readonly BATCH_DELAY_MS = 500;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const host = this.configService.get<string>('MEILISEARCH_HOST');
    const apiKey = this.configService.get<string>('MEILISEARCH_API_KEY');

    if (!host) {
      this.logger.warn('Meilisearch not configured (MEILISEARCH_HOST missing) - search features will use fallback');
      return;
    }

    try {
      this.client = new MeiliSearch({
        host,
        apiKey: apiKey || undefined,
        requestConfig: {
          timeout: 10000,
        },
      });

      // Verify connection with health check
      const health = await this.client.health();
      if (health.status !== 'available') {
        throw new Error(`Meilisearch status: ${health.status}`);
      }

      this.isConfigured = true;
      this.productsIndex = this.client.index(this.indexName);

      // Configure index settings for optimal performance
      await this.configureIndex();

      this.logger.log('Meilisearch initialized successfully');

      // Optionally sync products on startup
      if (this.configService.get('SYNC_PRODUCTS_ON_STARTUP') === 'true') {
        this.syncAllProducts().catch((err) => {
          this.logger.error(`Failed to sync products: ${err.message}`);
        });
      }
    } catch (error: any) {
      this.logger.warn(`Meilisearch initialization failed: ${error.message} - using fallback search`);
      this.isConfigured = false;
    }
  }

  async onModuleDestroy() {
    // Flush any pending index operations
    if (this.indexingTimeout) {
      clearTimeout(this.indexingTimeout);
      await this.flushIndexingQueue();
    }
  }

  /**
   * Check if Meilisearch is available
   */
  isAvailable(): boolean {
    return this.isConfigured && this.client !== null && this.productsIndex !== null;
  }

  /**
   * Configure index with optimized settings for e-commerce search
   */
  private async configureIndex(): Promise<void> {
    if (!this.productsIndex) return;

    const settings: Settings = {
      // Searchable attributes in priority order (higher = more important)
      searchableAttributes: [
        'name',
        'description',
        'tags',
        'category',
        'fandom',
        'sellerName',
        'sku',
        'barcode',
      ],

      // Filterable attributes for faceted search
      filterableAttributes: [
        'categoryId',
        'category',
        'fandom',
        'sellerId',
        'price',
        'stock',
        'averageRating',
        'isActive',
        'tags',
        'isPlatformOwned',
        'createdAt',
      ],

      // Sortable attributes
      sortableAttributes: [
        'price',
        'createdAt',
        'averageRating',
        'reviewCount',
        'stock',
        'name',
      ],

      // Ranking rules - order matters!
      rankingRules: [
        'words',        // Documents with more matching words rank higher
        'typo',         // Documents with fewer typos rank higher
        'proximity',    // Documents with closer words rank higher
        'attribute',    // Documents with matches in more important attributes rank higher
        'sort',         // Sort order if specified
        'exactness',    // Documents with more exact matches rank higher
      ],

      // Distinct attribute to avoid duplicates
      distinctAttribute: 'id',

      // Typo tolerance settings
      typoTolerance: {
        enabled: true,
        minWordSizeForTypos: {
          oneTypo: 4,   // Allow 1 typo for words >= 4 chars
          twoTypos: 8,  // Allow 2 typos for words >= 8 chars
        },
        disableOnWords: [],
        disableOnAttributes: ['id', 'sku', 'barcode'],
      },

      // Pagination settings
      pagination: {
        maxTotalHits: 10000,
      },

      // Faceting settings
      faceting: {
        maxValuesPerFacet: 100,
      },

      // Displayed attributes (return only necessary fields)
      displayedAttributes: [
        'id',
        'name',
        'description',
        'slug',
        'price',
        'currency',
        'stock',
        'category',
        'categoryId',
        'fandom',
        'sellerId',
        'sellerName',
        'sellerSlug',
        'averageRating',
        'reviewCount',
        'tags',
        'images',
        'isActive',
        'isPlatformOwned',
        'createdAt',
      ],

      // Synonyms for better search matching
      synonyms: {
        'tshirt': ['t-shirt', 'tee', 'shirt'],
        'hoodie': ['hoody', 'sweatshirt'],
        'mug': ['cup'],
        'poster': ['print', 'artwork'],
        'figure': ['figurine', 'statue', 'collectible'],
        'plush': ['plushie', 'soft toy', 'stuffed toy'],
      },

      // Stop words to ignore
      stopWords: [
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
        'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      ],
    };

    try {
      const task = await this.productsIndex.updateSettings(settings);
      await this.client!.waitForTask(task.taskUid, { timeOutMs: 30000 });
      this.logger.log('Meilisearch index settings configured');
    } catch (error: any) {
      this.logger.error(`Failed to configure index settings: ${error.message}`);
    }
  }

  /**
   * Index a single product (queued for batch processing)
   */
  async indexProduct(product: any): Promise<void> {
    if (!this.isAvailable()) return;

    const document = this.transformProductToDocument(product);
    this.indexingQueue.push(document);

    // Schedule batch flush
    if (!this.indexingTimeout) {
      this.indexingTimeout = setTimeout(() => {
        this.flushIndexingQueue();
      }, this.BATCH_DELAY_MS);
    }

    // Immediate flush if batch size reached
    if (this.indexingQueue.length >= this.BATCH_SIZE) {
      if (this.indexingTimeout) {
        clearTimeout(this.indexingTimeout);
        this.indexingTimeout = null;
      }
      await this.flushIndexingQueue();
    }
  }

  /**
   * Flush the indexing queue (batch index)
   */
  private async flushIndexingQueue(): Promise<void> {
    if (!this.isAvailable() || this.indexingQueue.length === 0) {
      this.indexingTimeout = null;
      return;
    }

    const documents = [...this.indexingQueue];
    this.indexingQueue = [];
    this.indexingTimeout = null;

    try {
      const task = await this.productsIndex!.addDocuments(documents, { primaryKey: 'id' });
      this.logger.debug(`Batch indexed ${documents.length} products (task: ${task.taskUid})`);
    } catch (error: any) {
      this.logger.error(`Batch indexing failed: ${error.message}`);
      // Re-queue failed documents for retry
      this.indexingQueue.unshift(...documents.slice(0, 50)); // Limit re-queue size
    }
  }

  /**
   * Transform product to Meilisearch document
   */
  private transformProductToDocument(product: any): Record<string, any> {
    return {
      id: product.id,
      name: product.name,
      description: product.description || '',
      slug: product.slug,
      sku: product.sku || null,
      barcode: product.barcode || null,
      price: parseFloat(product.price || '0'),
      currency: product.currency || 'GBP',
      stock: product.stock || 0,
      category: product.category || null,
      categoryId: product.categoryId || null,
      fandom: product.fandom || null,
      sellerId: product.sellerId || null,
      sellerName: product.seller?.storeName || null,
      sellerSlug: product.seller?.slug || null,
      averageRating: product.averageRating || 0,
      reviewCount: product.reviewCount || 0,
      tags: product.tags || [],
      images: product.images?.slice(0, 3).map((img: any) => ({
        url: img.url,
        alt: img.alt,
      })) || [],
      isActive: product.status === 'ACTIVE',
      isPlatformOwned: product.isPlatformOwned || false,
      createdAt: product.createdAt ? new Date(product.createdAt).getTime() : Date.now(),
    };
  }

  /**
   * Delete product from index
   */
  async deleteProduct(productId: string): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      await this.productsIndex!.deleteDocument(productId);
      this.logger.debug(`Deleted product from index: ${productId}`);
    } catch (error: any) {
      if (!error.message?.includes('not found')) {
        this.logger.error(`Failed to delete product ${productId}: ${error.message}`);
      }
    }
  }

  /**
   * Search products with advanced filtering
   */
  async search(query: string, filters: SearchFilters = {}): Promise<MeiliSearchResult> {
    if (!this.isAvailable()) {
      return this.fallbackSearch(query, filters);
    }

    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const offset = (page - 1) * limit;

    // Build filter string
    const filterConditions: string[] = ['isActive = true'];

    if (filters.categoryId) {
      filterConditions.push(`categoryId = "${filters.categoryId}"`);
    }
    if (filters.category) {
      filterConditions.push(`category = "${filters.category}"`);
    }
    if (filters.fandom) {
      filterConditions.push(`fandom = "${filters.fandom}"`);
    }
    if (filters.sellerId) {
      filterConditions.push(`sellerId = "${filters.sellerId}"`);
    }
    if (filters.minPrice !== undefined) {
      filterConditions.push(`price >= ${filters.minPrice}`);
    }
    if (filters.maxPrice !== undefined) {
      filterConditions.push(`price <= ${filters.maxPrice}`);
    }
    if (filters.minRating !== undefined) {
      filterConditions.push(`averageRating >= ${filters.minRating}`);
    }
    if (filters.inStock) {
      filterConditions.push(`stock > 0`);
    }
    if (filters.tags && filters.tags.length > 0) {
      const tagFilters = filters.tags.map(tag => `tags = "${tag}"`).join(' OR ');
      filterConditions.push(`(${tagFilters})`);
    }

    // Build search params
    const searchParams: SearchParams = {
      offset,
      limit,
      filter: filterConditions.join(' AND '),
      facets: ['categoryId', 'category', 'fandom', 'tags', 'sellerId'],
      attributesToHighlight: ['name', 'description'],
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
      showMatchesPosition: false,
      matchingStrategy: 'last', // Match as many words as possible
    };

    // Add sorting
    if (filters.sort) {
      const sortMappings: Record<string, string> = {
        'price_asc': 'price:asc',
        'price_desc': 'price:desc',
        'newest': 'createdAt:desc',
        'oldest': 'createdAt:asc',
        'rating': 'averageRating:desc',
        'popular': 'reviewCount:desc',
        'name_asc': 'name:asc',
        'name_desc': 'name:desc',
      };
      if (sortMappings[filters.sort]) {
        searchParams.sort = [sortMappings[filters.sort]];
      }
    }

    try {
      const result = await this.productsIndex!.search(query || '', searchParams);

      return {
        hits: result.hits,
        total: result.estimatedTotalHits || result.hits.length,
        processingTimeMs: result.processingTimeMs,
        facetDistribution: result.facetDistribution,
        query: result.query,
      };
    } catch (error: any) {
      this.logger.error(`Search error: ${error.message}`);
      return this.fallbackSearch(query, filters);
    }
  }

  /**
   * Get instant search suggestions (autocomplete)
   */
  async getSuggestions(prefix: string, limit: number = 10): Promise<string[]> {
    if (!this.isAvailable() || !prefix || prefix.length < 2) {
      return [];
    }

    try {
      const result = await this.productsIndex!.search(prefix, {
        limit,
        attributesToRetrieve: ['name'],
        attributesToHighlight: [],
        showMatchesPosition: false,
      });

      // Extract unique product names
      const suggestions = [...new Set(result.hits.map((hit: any) => hit.name))];
      return suggestions.slice(0, limit);
    } catch (error: any) {
      this.logger.error(`Suggestions error: ${error.message}`);
      return [];
    }
  }

  /**
   * Get trending/popular search terms
   */
  async getTrendingSearches(limit: number = 10): Promise<string[]> {
    // Meilisearch doesn't track search analytics natively
    // This could be enhanced with Redis to track popular searches
    // For now, return empty array or implement with external tracking
    return [];
  }

  /**
   * Sync all products from database to Meilisearch
   */
  async syncAllProducts(): Promise<{ indexed: number; failed: number }> {
    if (!this.isAvailable()) {
      return { indexed: 0, failed: 0 };
    }

    this.logger.log('Starting full product sync to Meilisearch...');
    
    let indexed = 0;
    let failed = 0;
    let skip = 0;
    const take = 500; // Larger batch for bulk sync

    try {
      // Clear existing index for full sync
      await this.productsIndex!.deleteAllDocuments();
      this.logger.log('Cleared existing index');

      while (true) {
        const products = await this.prisma.product.findMany({
          skip,
          take,
          where: {
            status: 'ACTIVE',
          },
          include: {
            seller: {
              select: {
                id: true,
                storeName: true,
                slug: true,
              },
            },
            images: {
              orderBy: { order: 'asc' },
              take: 3,
            },
          },
        });

        if (products.length === 0) break;

        const documents = products.map((p) => this.transformProductToDocument(p));
        
        try {
          const task = await this.productsIndex!.addDocuments(documents, { primaryKey: 'id' });
          await this.client!.waitForTask(task.taskUid, { timeOutMs: 60000 });
          indexed += documents.length;
        } catch (batchError: any) {
          this.logger.error(`Batch sync failed at offset ${skip}: ${batchError.message}`);
          failed += documents.length;
        }

        skip += take;
        this.logger.log(`Synced ${skip} products...`);
      }

      this.logger.log(`Product sync complete! Indexed: ${indexed}, Failed: ${failed}`);
    } catch (error: any) {
      this.logger.error(`Sync error: ${error.message}`);
    }

    return { indexed, failed };
  }

  /**
   * Fallback search using Prisma when Meilisearch is unavailable
   */
  private async fallbackSearch(query: string, filters: SearchFilters): Promise<MeiliSearchResult> {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      status: 'ACTIVE',
    };

    if (query && query.trim()) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
      ];
    }

    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.category) where.category = filters.category;
    if (filters.fandom) where.fandom = filters.fandom;
    if (filters.sellerId) where.sellerId = filters.sellerId;
    if (filters.minPrice !== undefined) where.price = { ...where.price, gte: filters.minPrice };
    if (filters.maxPrice !== undefined) where.price = { ...where.price, lte: filters.maxPrice };
    if (filters.inStock) where.stock = { gt: 0 };

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          seller: { select: { id: true, storeName: true, slug: true } },
          images: { orderBy: { order: 'asc' }, take: 3 },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      hits: products.map((p) => this.transformProductToDocument(p)),
      total,
      processingTimeMs: 0,
      query: query || '',
    };
  }

  /**
   * Get index stats
   */
  async getStats(): Promise<any> {
    if (!this.isAvailable()) {
      return { available: false };
    }

    try {
      const stats = await this.productsIndex!.getStats();
      return {
        available: true,
        numberOfDocuments: stats.numberOfDocuments,
        isIndexing: stats.isIndexing,
        fieldDistribution: stats.fieldDistribution,
      };
    } catch (error: any) {
      return { available: false, error: error.message };
    }
  }

  /**
   * Rebuild entire index (drop and recreate)
   */
  async rebuildIndex(): Promise<void> {
    if (!this.client) return;

    try {
      // Delete existing index
      try {
        await this.client.deleteIndex(this.indexName);
        this.logger.log('Deleted existing index');
      } catch {
        // Index might not exist
      }

      // Create new index
      const task = await this.client.createIndex(this.indexName, { primaryKey: 'id' });
      await this.client.waitForTask(task.taskUid);
      
      this.productsIndex = this.client.index(this.indexName);
      await this.configureIndex();
      
      // Re-sync all products
      await this.syncAllProducts();
      
      this.logger.log('Index rebuild complete');
    } catch (error: any) {
      this.logger.error(`Index rebuild failed: ${error.message}`);
      throw error;
    }
  }
}
