import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueService, JobType } from '../../queue/queue.service';
import { PrismaService } from '../../database/prisma.service';
import { DiscrepanciesService } from '../../discrepancies/discrepancies.service';
import { ActivityService } from '../../activity/activity.service';

@Injectable()
export class MonitoringJobsService implements OnModuleInit {
  private readonly logger = new Logger(MonitoringJobsService.name);

  constructor(
    private queue: QueueService,
    private config: ConfigService,
    private prisma: PrismaService,
    private discrepanciesService: DiscrepanciesService,
    private activityService: ActivityService,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(JobType.MONITORING_HEALTH_CHECK, async () => {
      await this.performHealthCheck();
    });

    this.queue.registerProcessor(JobType.MONITORING_DISCREPANCY_SCAN, async () => {
      await this.scanForDiscrepancies();
    });

    try {
      await this.queue.addRepeatable(
        JobType.MONITORING_HEALTH_CHECK,
        {},
        this.config.get<string>('MONITORING_HEALTH_CHECK_CRON', '*/15 * * * *'),
      );
      await this.queue.addRepeatable(
        JobType.MONITORING_DISCREPANCY_SCAN,
        {},
        this.config.get<string>('MONITORING_DISCREPANCY_SCAN_CRON', '0 */4 * * *'),
      );
      this.logger.log('Monitoring crons scheduled (health check every 15min, discrepancy scan every 4h)');
    } catch (e) {
      this.logger.warn(`Monitoring cron schedule failed: ${(e as Error).message}`);
    }
  }

  private async performHealthCheck(): Promise<void> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const [
      pendingNotifications,
      failedNotifications,
      stuckOrders,
      openDiscrepancies,
    ] = await Promise.all([
      this.prisma.notification.count({ where: { status: 'PENDING' as any, createdAt: { lt: fiveMinutesAgo } } }),
      this.prisma.notification.count({ where: { status: 'FAILED' as any } }),
      this.prisma.order.count({
        where: { status: 'PROCESSING', updatedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.discrepancy.count({ where: { status: 'OPEN' } }),
    ]);

    if (pendingNotifications > 50) {
      this.logger.warn(`Health check: ${pendingNotifications} notifications stuck in PENDING state`);
    }

    if (failedNotifications > 10) {
      this.logger.warn(`Health check: ${failedNotifications} failed notifications require attention`);
    }

    if (stuckOrders > 0) {
      this.logger.warn(`Health check: ${stuckOrders} orders stuck in PROCESSING for >24h`);
    }

    this.logger.log(`Health check: notifications(pending=${pendingNotifications}, failed=${failedNotifications}), stuckOrders=${stuckOrders}, discrepancies=${openDiscrepancies}`);
  }

  private async scanForDiscrepancies(): Promise<void> {
    this.logger.log('Starting discrepancy scan...');
    let detected = 0;

    // Scan for negative inventory
    const negativeStockProducts = await this.prisma.product.findMany({
      where: { stock: { lt: 0 } },
      select: { id: true, name: true, stock: true, sellerId: true },
      take: 100,
    });

    for (const product of negativeStockProducts) {
      try {
        const existing = await this.prisma.discrepancy.findFirst({
          where: { productId: product.id, type: 'INVENTORY', status: 'OPEN' },
        });
        if (!existing) {
          await this.discrepanciesService.createDiscrepancy({
            type: 'INVENTORY',
            productId: product.id,
            sellerId: product.sellerId || undefined,
            severity: 'HIGH',
            expectedValue: { stock: '>= 0' },
            actualValue: { stock: product.stock },
            description: `Product "${product.name}" has negative stock: ${product.stock}`,
          });
          detected++;
        }
      } catch (e) {
        this.logger.warn(`Discrepancy scan failed for product ${product.id}: ${(e as Error).message}`);
      }
    }

    // Scan for orders stuck in PROCESSING for > 48 hours
    const stuckOrders = await this.prisma.order.findMany({
      where: {
        status: 'PROCESSING',
        updatedAt: { lt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
      },
      select: { id: true, orderNumber: true, sellerId: true },
      take: 50,
    });

    for (const order of stuckOrders) {
      try {
        const existing = await this.prisma.discrepancy.findFirst({
          where: { orderId: order.id, type: 'ORDER_FULFILLMENT', status: 'OPEN' },
        });
        if (!existing) {
          await this.discrepanciesService.createDiscrepancy({
            type: 'ORDER_FULFILLMENT',
            orderId: order.id,
            sellerId: order.sellerId || undefined,
            severity: 'MEDIUM',
            expectedValue: { status: 'FULFILLED or SHIPPED within 48h' },
            actualValue: { status: 'PROCESSING', stuckSince: '48+ hours' },
            description: `Order ${order.orderNumber} has been stuck in PROCESSING for over 48 hours`,
          });
          detected++;
        }
      } catch (e) {
        this.logger.warn(`Discrepancy scan failed for order ${order.id}: ${(e as Error).message}`);
      }
    }

    this.activityService.createLog({
      action: 'DISCREPANCY_SCAN_COMPLETED',
      entityType: 'System',
      description: `Discrepancy scan completed: ${detected} new discrepancies detected (${negativeStockProducts.length} negative stock, ${stuckOrders.length} stuck orders)`,
      metadata: { detected, negativeStock: negativeStockProducts.length, stuckOrders: stuckOrders.length },
    }).catch((e) => this.logger.warn(`Activity log failed: ${(e as Error).message}`));

    this.logger.log(`Discrepancy scan complete: ${detected} new discrepancies detected`);
  }
}
