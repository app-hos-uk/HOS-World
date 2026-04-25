import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job } from 'bullmq';
import { QueueService, JobType } from '../../queue/queue.service';
import { SegmentationService } from '../segmentation.service';

@Injectable()
export class SegmentJobsService implements OnModuleInit {
  private readonly logger = new Logger(SegmentJobsService.name);

  constructor(
    private queue: QueueService,
    private config: ConfigService,
    private segmentation: SegmentationService,
  ) {}

  async onModuleInit() {
    this.queue.registerProcessor(JobType.SEGMENT_REFRESH, async (job: Job) => {
      const segmentId = job.data?.segmentId as string | undefined;
      if (segmentId) {
        await this.segmentation.evaluateSegment(segmentId);
      }
    });

    this.queue.registerProcessor(JobType.SEGMENT_REFRESH_ALL, async () => {
      const r = await this.segmentation.evaluateAllActive();
      this.logger.log(`Segment refresh-all: evaluated ${r.evaluated}, errors ${r.errors}`);
    });

    try {
      await this.queue.addRepeatable(
        JobType.SEGMENT_REFRESH_ALL,
        {},
        this.config.get<string>('SEGMENT_REFRESH_CRON', '0 3 * * *'),
      );
      this.logger.log('Segment refresh cron scheduled');
    } catch (e) {
      this.logger.warn(`Segment cron schedule failed: ${(e as Error).message}`);
    }
  }
}
