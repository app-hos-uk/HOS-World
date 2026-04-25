import { Injectable, Logger } from '@nestjs/common';
import type { JourneyEnrollment, MarketingJourney, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import type { JourneyStep } from './journey.types';

type EnrollmentWithJourney = JourneyEnrollment & { journey: MarketingJourney };

@Injectable()
export class JourneyService {
  private readonly logger = new Logger(JourneyService.name);

  private readonly repeatableTriggers = new Set([
    'ORDER_PAID',
    'CART_ABANDONED',
    'MEMBER_INACTIVE',
    'POINTS_EXPIRY_WARNING',
    'LOYALTY_BIRTHDAY',
  ]);

  constructor(
    private prisma: PrismaService,
    private messaging: MessagingService,
  ) {}

  async enrollUser(
    journeySlug: string,
    userId: string,
    metadata?: Record<string, unknown>,
  ): Promise<JourneyEnrollment | null> {
    const journey = await this.prisma.marketingJourney.findUnique({
      where: { slug: journeySlug },
    });
    if (!journey?.isActive) return null;

    const existing = await this.prisma.journeyEnrollment.findUnique({
      where: {
        journeyId_userId: { journeyId: journey.id, userId },
      },
    });

    if (existing?.status === 'ACTIVE') {
      this.logger.debug(`Skip duplicate ACTIVE enrollment ${journeySlug} for ${userId}`);
      return null;
    }

    const mergedMeta = (metadata || {}) as Prisma.InputJsonValue;

    if (
      existing &&
      (existing.status === 'COMPLETED' ||
        existing.status === 'CANCELLED' ||
        existing.status === 'PAUSED')
    ) {
      if (!this.repeatableTriggers.has(journey.triggerEvent)) return null;
      return this.prisma.journeyEnrollment.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          currentStep: 0,
          startedAt: new Date(),
          completedAt: null,
          lastStepAt: null,
          nextStepAt: new Date(),
          metadata: mergedMeta,
        },
      });
    }

    if (existing) return null;

    return this.prisma.journeyEnrollment.create({
      data: {
        journeyId: journey.id,
        userId,
        currentStep: 0,
        status: 'ACTIVE',
        nextStepAt: new Date(),
        metadata: mergedMeta,
      },
    });
  }

  async processDueEnrollments(limit = 100): Promise<number> {
    const due = await this.prisma.journeyEnrollment.findMany({
      where: {
        status: 'ACTIVE',
        nextStepAt: { lte: new Date() },
      },
      take: limit,
      orderBy: { nextStepAt: 'asc' },
    });

    let n = 0;
    for (const e of due) {
      try {
        await this.processStep(e.id);
        n++;
      } catch (err) {
        this.logger.warn(`processStep ${e.id}: ${(err as Error).message}`);
      }
    }
    return n;
  }

  async processStep(enrollmentId: string): Promise<void> {
    const maxIterations = 64;
    for (let iter = 0; iter < maxIterations; iter++) {
      const enrollment = await this.prisma.journeyEnrollment.findUnique({
        where: { id: enrollmentId },
        include: { journey: true },
      });
      if (!enrollment || enrollment.status !== 'ACTIVE') return;

      const steps = this.sortedSteps(enrollment.journey);
      if (enrollment.currentStep >= steps.length) {
        await this.prisma.journeyEnrollment.update({
          where: { id: enrollmentId },
          data: { status: 'COMPLETED', completedAt: new Date(), nextStepAt: null },
        });
        return;
      }

      const step = steps[enrollment.currentStep];

      if (step.type === 'WAIT') {
        const done = await this.handleWaitStep(enrollmentId, enrollment, step);
        if (!done) return;
        continue;
      }

      if (step.type === 'SEND') {
        if (!step.templateSlug) {
          this.logger.warn(`SEND step at index ${enrollment.currentStep} missing templateSlug — marking FAILED`);
          await this.prisma.journeyEnrollment.update({
            where: { id: enrollmentId },
            data: { status: 'FAILED', nextStepAt: null },
          });
          return;
        }
        await this.handleSendStep(enrollment as EnrollmentWithJourney, step);
        await this.advance(enrollmentId, enrollment.currentStep + 1);
        continue;
      }

      if (step.type === 'CONDITION') {
        const nextIdx = await this.evaluateConditionBranch(enrollment as EnrollmentWithJourney, step);
        await this.advance(enrollmentId, nextIdx);
        continue;
      }

      if (step.type === 'SPLIT') {
        await this.advance(enrollmentId, enrollment.currentStep + 1);
        continue;
      }

      this.logger.warn(`Unknown step type "${step.type}" at index ${enrollment.currentStep} — skipping`);
      await this.advance(enrollmentId, enrollment.currentStep + 1);
    }
    this.logger.warn(`processStep aborted after ${maxIterations} iterations (${enrollmentId})`);
  }

  private sortedSteps(journey: MarketingJourney): JourneyStep[] {
    const raw = journey.steps as unknown;
    const arr = Array.isArray(raw) ? (raw as JourneyStep[]) : [];
    return arr.slice().sort((a, b) => a.stepIndex - b.stepIndex);
  }

  private async handleWaitStep(
    enrollmentId: string,
    enrollment: JourneyEnrollment,
    step: JourneyStep,
  ): Promise<boolean> {
    const delayMs = (step.delayMinutes ?? 0) * 60 * 1000;
    const meta = (enrollment.metadata as Record<string, unknown>) || {};
    const scheduled = meta.waitScheduledForStep === enrollment.currentStep;

    if (delayMs === 0) {
      await this.prisma.journeyEnrollment.update({
        where: { id: enrollmentId },
        data: {
          currentStep: enrollment.currentStep + 1,
          nextStepAt: new Date(),
          lastStepAt: new Date(),
        },
      });
      return true;
    }

    if (enrollment.nextStepAt && enrollment.nextStepAt.getTime() > Date.now()) {
      return false;
    }

    if (!scheduled) {
      await this.prisma.journeyEnrollment.update({
        where: { id: enrollmentId },
        data: {
          nextStepAt: new Date(Date.now() + delayMs),
          lastStepAt: new Date(),
          metadata: {
            ...meta,
            waitScheduledForStep: enrollment.currentStep,
          } as Prisma.InputJsonValue,
        },
      });
      return false;
    }

    await this.prisma.journeyEnrollment.update({
      where: { id: enrollmentId },
      data: {
        currentStep: enrollment.currentStep + 1,
        nextStepAt: new Date(),
        lastStepAt: new Date(),
        metadata: {
          ...meta,
          waitScheduledForStep: null,
        } as Prisma.InputJsonValue,
      },
    });
    return true;
  }

  private async advance(enrollmentId: string, nextStep: number): Promise<void> {
    await this.prisma.journeyEnrollment.update({
      where: { id: enrollmentId },
      data: {
        currentStep: nextStep,
        nextStepAt: new Date(),
        lastStepAt: new Date(),
      },
    });
  }

  private async handleSendStep(enrollment: EnrollmentWithJourney, step: JourneyStep): Promise<void> {
    const vars = await this.buildRuntimeVars(enrollment);
    const staticVars = Object.fromEntries(
      Object.entries(step.templateVars || {}).map(([k, v]) => [k, String(v)]),
    );
    const merged = { ...vars, ...staticVars };
    await this.messaging.send({
      userId: enrollment.userId,
      channel: step.channel,
      templateSlug: step.templateSlug,
      templateVars: merged,
      subject: step.subject,
      journeyId: enrollment.journeyId,
      enrollmentId: enrollment.id,
    });
  }

  private async buildRuntimeVars(enrollment: EnrollmentWithJourney): Promise<Record<string, string>> {
    const user = await this.prisma.user.findUnique({
      where: { id: enrollment.userId },
      include: { loyaltyMembership: { include: { tier: true } } },
    });
    const meta = (enrollment.metadata as Record<string, unknown>) || {};
    const m = user?.loyaltyMembership;
    const firstName = user?.firstName || 'there';
    return {
      firstName,
      customerName: firstName,
      tierName: m?.tier?.name || '',
      newTier: String(meta.newTier ?? m?.tier?.name ?? ''),
      oldTier: String(meta.oldTier ?? ''),
      orderNumber: String(meta.orderNumber ?? ''),
      orderId: String(meta.orderId ?? ''),
      loyaltyPointsEarned: String(meta.loyaltyPointsEarned ?? meta.points ?? ''),
      points: String(meta.points ?? meta.loyaltyPointsEarned ?? ''),
      productName: String(meta.productName ?? 'your purchase'),
      expiringPoints: String(meta.expiringPoints ?? m?.currentBalance ?? '0'),
      expiryDate: String(meta.expiryDate ?? ''),
      bonusPoints: String(meta.bonusPoints ?? '50'),
      itemCount: String(meta.itemCount ?? '0'),
      cartTotal: String(meta.cartTotal ?? ''),
      membershipId: String(meta.membershipId ?? m?.id ?? ''),
    };
  }

  private async evaluateConditionBranch(
    enrollment: EnrollmentWithJourney,
    step: JourneyStep,
  ): Promise<number> {
    const cond = step.condition;
    if (!cond) return enrollment.currentStep + 1;
    const ok = await this.conditionHolds(enrollment, cond);
    if (ok) return enrollment.currentStep + 1;
    if (step.skipToStep !== undefined && step.skipToStep !== null) return step.skipToStep;
    return enrollment.currentStep + 2;
  }

  private async conditionHolds(
    enrollment: EnrollmentWithJourney,
    cond: NonNullable<JourneyStep['condition']>,
  ): Promise<boolean> {
    const val = await this.resolveField(enrollment, cond.field);
    switch (cond.operator) {
      case 'eq':
        return val == cond.value;
      case 'gt':
        return Number(val) > Number(cond.value);
      case 'lt':
        return Number(val) < Number(cond.value);
      case 'exists':
        return val !== undefined && val !== null;
      case 'not_exists':
        return val === undefined || val === null;
      default:
        this.logger.warn(`Unknown condition operator "${cond.operator}"`);
        return false;
    }
  }

  private async resolveField(enrollment: EnrollmentWithJourney, field: string): Promise<unknown> {
    const meta = (enrollment.metadata as Record<string, unknown>) || {};
    if (field.startsWith('metadata.')) {
      return meta[field.slice('metadata.'.length)];
    }
    if (field.startsWith('user.loyaltyMembership.')) {
      const user = await this.prisma.user.findUnique({
        where: { id: enrollment.userId },
        include: { loyaltyMembership: true },
      });
      const m = user?.loyaltyMembership;
      if (!m) return undefined;
      const sub = field.replace('user.loyaltyMembership.', '');
      return (m as Record<string, unknown>)[sub];
    }
    return undefined;
  }

  async cancelEnrollment(enrollmentId: string): Promise<void> {
    await this.prisma.journeyEnrollment.update({
      where: { id: enrollmentId },
      data: { status: 'CANCELLED', nextStepAt: null },
    });
  }

  async getJourneyStats(journeyId: string) {
    const [active, completed, cancelled, messages] = await Promise.all([
      this.prisma.journeyEnrollment.count({ where: { journeyId, status: 'ACTIVE' } }),
      this.prisma.journeyEnrollment.count({ where: { journeyId, status: 'COMPLETED' } }),
      this.prisma.journeyEnrollment.count({ where: { journeyId, status: 'CANCELLED' } }),
      this.prisma.messageLog.count({ where: { journeyId } }),
    ]);
    return { active, completed, cancelled, messages };
  }

  async matchesTriggerConditions(
    journey: MarketingJourney,
    userId: string,
    _data?: Record<string, unknown>,
  ): Promise<boolean> {
    const cond = journey.triggerConditions as Record<string, unknown> | null;
    const hasCond = cond && Object.keys(cond).length > 0;

    if (hasCond) {
      const m = await this.prisma.loyaltyMembership.findUnique({
        where: { userId },
        include: { tier: true },
      });
      if (typeof cond.tierSlug === 'string' && m?.tier.slug !== cond.tierSlug) return false;
      if (journey.regionCodes?.length && m?.regionCode) {
        if (!journey.regionCodes.includes(m.regionCode)) return false;
      }
    }

    if (journey.segmentId) {
      const membership = await this.prisma.segmentMembership.findUnique({
        where: { segmentId_userId: { segmentId: journey.segmentId, userId } },
      });
      if (!membership) return false;
    }

    return true;
  }
}
