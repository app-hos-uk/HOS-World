import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SettlementsService } from './settlements.service';

/**
 * Settlement Scheduler Service
 *
 * Provides automated settlement processing capabilities.
 * Can be triggered by:
 * 1. Manual API call (admin-only endpoint)
 * 2. External cron job calling the API endpoint
 * 3. NestJS @Cron decorator (if @nestjs/schedule is installed)
 *
 * To enable NestJS built-in scheduling:
 * 1. Install: npm install @nestjs/schedule
 * 2. Add ScheduleModule.forRoot() to AppModule
 * 3. Uncomment the @Cron decorators below
 */
@Injectable()
export class SettlementSchedulerService {
  private readonly logger = new Logger(SettlementSchedulerService.name);
  private isProcessing = false;

  constructor(
    private prisma: PrismaService,
    private settlementsService: SettlementsService,
  ) {}

  /**
   * Create settlements for all active sellers for the previous week
   * Run weekly on Monday at midnight
   *
   * If using @nestjs/schedule, uncomment:
   * @Cron('0 0 * * 1') // Every Monday at midnight
   */
  async createWeeklySettlements(): Promise<{
    created: number;
    failed: number;
    errors: string[];
  }> {
    if (this.isProcessing) {
      this.logger.warn('Settlement creation already in progress, skipping...');
      return { created: 0, failed: 0, errors: ['Already processing'] };
    }

    this.isProcessing = true;
    const results = { created: 0, failed: 0, errors: [] as string[] };

    try {
      this.logger.log('Starting weekly settlement creation...');

      // Calculate previous week's date range
      const now = new Date();
      const periodEnd = new Date(now);
      periodEnd.setHours(0, 0, 0, 0);
      // Go back to start of current week (Monday)
      const dayOfWeek = periodEnd.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      periodEnd.setDate(periodEnd.getDate() - daysToMonday);

      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 7);

      this.logger.log(
        `Settlement period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`,
      );

      // Get sellers who have completed orders in the settlement period
      // We don't filter by verified status because:
      // 1. Settlements are for any seller who has fulfilled orders
      // 2. Verification is an onboarding status, not a payment eligibility status
      // 3. Non-verified sellers who completed orders should still receive payment
      const sellers = await this.prisma.seller.findMany({
        where: {
          orders: {
            some: {
              status: 'DELIVERED',
              createdAt: {
                gte: periodStart,
                lte: periodEnd,
              },
            },
          },
        },
        select: {
          id: true,
          storeName: true,
          userId: true,
        },
      });

      this.logger.log(`Processing ${sellers.length} sellers with orders in settlement period...`);

      for (const seller of sellers) {
        try {
          // Check if settlement already exists for this period
          const existingSettlement = await this.prisma.settlement.findFirst({
            where: {
              sellerId: seller.id,
              periodStart: {
                gte: periodStart,
              },
              periodEnd: {
                lte: periodEnd,
              },
            },
          });

          if (existingSettlement) {
            this.logger.debug(`Settlement already exists for ${seller.storeName}, skipping...`);
            continue;
          }

          // Calculate if there are orders to settle
          const calculation = await this.settlementsService.calculateSettlement(
            seller.id,
            periodStart,
            periodEnd,
          );

          if (calculation.totalOrders === 0) {
            this.logger.debug(`No orders to settle for ${seller.storeName}`);
            continue;
          }

          // Create settlement
          await this.settlementsService.createSettlement(seller.userId, {
            sellerId: seller.id,
            periodStart: periodStart.toISOString(),
            periodEnd: periodEnd.toISOString(),
            notes: 'Auto-generated weekly settlement',
          });

          results.created++;
          this.logger.log(
            `Created settlement for ${seller.storeName}: ${calculation.totalOrders} orders, £${calculation.netAmount.toFixed(2)}`,
          );
        } catch (error: any) {
          results.failed++;
          results.errors.push(`${seller.storeName}: ${error.message}`);
          this.logger.error(
            `Failed to create settlement for ${seller.storeName}: ${error.message}`,
          );
        }
      }

      this.logger.log(
        `Settlement creation complete: ${results.created} created, ${results.failed} failed`,
      );
      return results;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Clean up expired stock reservations
   * Run every hour
   *
   * If using @nestjs/schedule, uncomment:
   * @Cron('0 * * * *') // Every hour
   */
  async cleanupExpiredReservations(): Promise<{ cleaned: number }> {
    try {
      this.logger.log('Cleaning up expired stock reservations...');

      const result = await this.prisma.stockReservation.updateMany({
        where: {
          status: 'ACTIVE',
          expiresAt: {
            lt: new Date(),
          },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      // Update reserved counts on inventory locations
      const expiredReservations = await this.prisma.stockReservation.findMany({
        where: {
          status: 'EXPIRED',
          updatedAt: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
        select: {
          inventoryLocationId: true,
          quantity: true,
        },
      });

      for (const reservation of expiredReservations) {
        await this.prisma.inventoryLocation.update({
          where: { id: reservation.inventoryLocationId },
          data: {
            reserved: {
              decrement: reservation.quantity,
            },
          },
        });
      }

      this.logger.log(`Cleaned up ${result.count} expired reservations`);
      return { cleaned: result.count };
    } catch (error: any) {
      this.logger.error(`Failed to cleanup reservations: ${error.message}`);
      return { cleaned: 0 };
    }
  }

  /**
   * Send settlement reminders for pending settlements older than 7 days
   * Run daily at 9 AM
   *
   * If using @nestjs/schedule, uncomment:
   * @Cron('0 9 * * *') // Every day at 9 AM
   */
  async sendSettlementReminders(): Promise<{ sent: number }> {
    try {
      this.logger.log('Checking for pending settlement reminders...');

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const pendingSettlements = await this.prisma.settlement.findMany({
        where: {
          status: 'PENDING',
          createdAt: {
            lt: sevenDaysAgo,
          },
        },
        include: {
          seller: {
            select: {
              storeName: true,
              userId: true,
            },
          },
        },
      });

      // Log reminders (in production, would send emails)
      for (const settlement of pendingSettlements) {
        this.logger.warn(
          `Pending settlement reminder: ${settlement.seller.storeName} - £${Number(settlement.netAmount).toFixed(2)} (created ${settlement.createdAt.toISOString()})`,
        );
      }

      this.logger.log(`Found ${pendingSettlements.length} settlements needing attention`);
      return { sent: pendingSettlements.length };
    } catch (error: any) {
      this.logger.error(`Failed to send reminders: ${error.message}`);
      return { sent: 0 };
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isProcessing: boolean;
    lastRun?: Date;
  } {
    return {
      isProcessing: this.isProcessing,
    };
  }
}
