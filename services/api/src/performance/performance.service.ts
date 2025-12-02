import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Analyze and optimize database queries
   * This service provides methods for query analysis and optimization suggestions
   */

  /**
   * Get database query statistics
   */
  async getQueryStats() {
    // Note: Prisma doesn't expose query stats directly
    // In production, you'd use PostgreSQL's pg_stat_statements extension
    return {
      message: 'Query statistics available via pg_stat_statements extension',
      recommendations: [
        'Enable pg_stat_statements extension',
        'Monitor slow queries',
        'Add indexes on frequently queried columns',
      ],
    };
  }

  /**
   * Get index recommendations based on schema
   */
  getIndexRecommendations() {
    return {
      recommendations: [
        {
          table: 'products',
          columns: ['sellerId', 'isActive'],
          index: 'CREATE INDEX idx_products_seller_active ON products(sellerId, isActive)',
          reason: 'Frequently filtered by seller and active status',
        },
        {
          table: 'products',
          columns: ['category', 'isActive'],
          index: 'CREATE INDEX idx_products_category_active ON products(category, isActive)',
          reason: 'Category filtering with active status',
        },
        {
          table: 'products',
          columns: ['createdAt'],
          index: 'CREATE INDEX idx_products_created_at ON products(createdAt DESC)',
          reason: 'Sorting by newest products',
        },
        {
          table: 'orders',
          columns: ['userId', 'status'],
          index: 'CREATE INDEX idx_orders_user_status ON orders(userId, status)',
          reason: 'User order queries with status filter',
        },
        {
          table: 'orders',
          columns: ['sellerId', 'status'],
          index: 'CREATE INDEX idx_orders_seller_status ON orders(sellerId, status)',
          reason: 'Seller order queries with status filter',
        },
        {
          table: 'order_items',
          columns: ['orderId'],
          index: 'CREATE INDEX idx_order_items_order_id ON order_items(orderId)',
          reason: 'Fetching order items by order',
        },
        {
          table: 'product_reviews',
          columns: ['productId', 'status'],
          index: 'CREATE INDEX idx_reviews_product_status ON product_reviews(productId, status)',
          reason: 'Filtering reviews by product and status',
        },
        {
          table: 'cart_items',
          columns: ['cartId'],
          index: 'CREATE INDEX idx_cart_items_cart_id ON cart_items(cartId)',
          reason: 'Fetching cart items',
        },
      ],
    };
  }

  /**
   * Connection pool configuration recommendations
   */
  getConnectionPoolRecommendations() {
    return {
      recommendations: {
        maxConnections: '10-20 connections per application instance',
        idleTimeout: '10 seconds',
        connectionTimeout: '5 seconds',
        statementTimeout: '30 seconds',
        queryTimeout: '30 seconds',
      },
      prismaConfig: {
        datasource: {
          db: {
            connectionLimit: 10,
            poolTimeout: 10,
          },
        },
      },
    };
  }
}

