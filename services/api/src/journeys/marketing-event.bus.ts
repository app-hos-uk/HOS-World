import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { JourneyService } from './journey.service';

@Injectable()
export class MarketingEventBus {
  private readonly logger = new Logger(MarketingEventBus.name);

  constructor(
    private prisma: PrismaService,
    private journeyService: JourneyService,
  ) {}

  /**
   * Find active journeys for the trigger, match conditions, enroll user (or restart repeatable).
   */
  async emit(event: string, userId: string, data?: Record<string, unknown>): Promise<void> {
    const journeys = await this.prisma.marketingJourney.findMany({
      where: { isActive: true, triggerEvent: event },
    });
    for (const j of journeys) {
      try {
        const ok = await this.journeyService.matchesTriggerConditions(j, userId, data);
        if (!ok) continue;
        await this.journeyService.enrollUser(j.slug, userId, data);
      } catch (e) {
        this.logger.warn(`emit ${event} journey ${j.slug}: ${(e as Error).message}`);
      }
    }
  }

  /**
   * Broadcast a system-level event that has no single user context (e.g. EVENT_PUBLISHED).
   * Logs the event for observability. No journey enrollment occurs because there is no
   * target user — downstream consumers can query the payload if needed.
   */
  async broadcast(event: string, data?: Record<string, unknown>): Promise<void> {
    this.logger.log(`broadcast: ${event} ${JSON.stringify(data ?? {})}`);
  }
}
