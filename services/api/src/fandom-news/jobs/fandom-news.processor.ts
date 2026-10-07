import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueService, JobType } from '../../queue/queue.service';
import { FandomNewsService } from '../fandom-news.service';

@Injectable()
export class FandomNewsProcessor implements OnModuleInit {
  private readonly logger = new Logger(FandomNewsProcessor.name);

  constructor(
    private queue: QueueService,
    private config: ConfigService,
    private fandomNews: FandomNewsService,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(JobType.FANDOM_NEWS_FETCH, async () => {
      const results = await this.fandomNews.fetchAllActiveSources();
      const created = results.reduce((sum, result) => sum + (result.created ?? 0), 0);
      this.logger.log(`Fandom news fetch: ${results.length} sources, ${created} new articles`);
    });

    this.queue.registerProcessor(JobType.FANDOM_NEWS_CLEANUP, async () => {
      const removed = await this.fandomNews.cleanupOldArticles(90);
      this.logger.log(`Fandom news cleanup removed ${removed} auto articles older than 90 days`);
    });

    try {
      await this.queue.addRepeatable(
        JobType.FANDOM_NEWS_FETCH,
        {},
        this.config.get<string>('FANDOM_NEWS_FETCH_CRON', '*/30 * * * *'),
      );
      await this.queue.addRepeatable(
        JobType.FANDOM_NEWS_CLEANUP,
        {},
        this.config.get<string>('FANDOM_NEWS_CLEANUP_CRON', '0 4 * * *'),
      );
      this.logger.log('Fandom news fetch and cleanup cron jobs scheduled');
    } catch (e) {
      this.logger.warn(`Fandom news cron schedule failed: ${(e as Error).message}`);
    }
  }
}
