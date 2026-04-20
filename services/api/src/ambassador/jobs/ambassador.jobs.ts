import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { QueueService, JobType } from '../../queue/queue.service';
import { AmbassadorService } from '../ambassador.service';
import { AmbassadorAchievementService } from '../achievements/achievement.service';

@Injectable()
export class AmbassadorJobsService implements OnModuleInit {
  private readonly logger = new Logger(AmbassadorJobsService.name);

  constructor(
    private queue: QueueService,
    private config: ConfigService,
    private ambassador: AmbassadorService,
    private achievements: AmbassadorAchievementService,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(JobType.AMBASSADOR_TIER_REVIEW, async () => {
      await this.ambassador.runDailyTierGuardsAndProgression();
      this.logger.log('Ambassador tier review completed');
    });

    this.queue.registerProcessor(JobType.AMBASSADOR_ACHIEVEMENT_CHECK, async (job: Job) => {
      const ambassadorId = job.data?.ambassadorId as string | undefined;
      if (ambassadorId) {
        await this.achievements.checkAndAward(ambassadorId);
      } else {
        await this.ambassador.runAchievementCheckAll();
      }
    });

    try {
      await this.queue.addRepeatable(
        JobType.AMBASSADOR_TIER_REVIEW,
        {},
        this.config.get<string>('AMBASSADOR_TIER_REVIEW_CRON', '0 4 * * *'),
      );
      this.logger.log('Ambassador tier review cron scheduled');
    } catch (e) {
      this.logger.warn(`Ambassador cron schedule failed: ${(e as Error).message}`);
    }
  }
}
