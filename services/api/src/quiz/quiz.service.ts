import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { LoyaltyListener } from '../loyalty/listeners/loyalty.listener';
import { SegmentationService } from '../segmentation/segmentation.service';
import { CreateQuizDto } from './dto/create-quiz.dto';

export type QuizQuestion = { question: string; options: string[]; correctIndex: number };

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @Inject(forwardRef(() => LoyaltyListener))
    private loyaltyListener: LoyaltyListener,
    private segmentation: SegmentationService,
  ) {}

  async listQuizzes(fandomId?: string) {
    const now = new Date();
    const where: Record<string, unknown> = {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    };
    if (fandomId) where.fandomId = fandomId;

    return this.prisma.fandomQuiz.findMany({
      where,
      include: { fandom: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuizForPlayer(quizId: string) {
    const quiz = await this.prisma.fandomQuiz.findFirst({
      where: { id: quizId, isActive: true },
      include: { fandom: { select: { name: true } } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const raw = quiz.questions as unknown as QuizQuestion[];
    const questions = raw.map((q, index) => ({
      index,
      question: q.question,
      options: q.options,
    }));

    return {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      fandomName: quiz.fandom?.name,
      difficulty: quiz.difficulty,
      pointsReward: quiz.pointsReward,
      questionCount: raw.length,
      questions,
    };
  }

  async submitQuiz(userId: string, quizId: string, answers: number[]) {
    const quiz = await this.prisma.fandomQuiz.findFirst({ where: { id: quizId, isActive: true } });
    if (!quiz) throw new NotFoundException('Quiz not found');

    const maxPerWeek = this.config.get<number>('QUIZ_MAX_PER_WEEK', 1);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const recentAttempts = await this.prisma.fandomQuizAttempt.count({
      where: { userId, completedAt: { gte: weekAgo } },
    });
    if (recentAttempts >= maxPerWeek) {
      throw new BadRequestException('Weekly quiz attempt limit reached');
    }

    const questions = quiz.questions as unknown as QuizQuestion[];
    if (answers.length !== questions.length) {
      throw new BadRequestException(`Expected ${questions.length} answers`);
    }

    let score = 0;
    for (let i = 0; i < questions.length; i++) {
      const ans = answers[i];
      const q = questions[i];
      if (ans >= 0 && ans < q.options.length && ans === q.correctIndex) score++;
    }

    const passThreshold = this.config.get<number>('QUIZ_PASS_THRESHOLD', 0.5);
    const need = Math.ceil(questions.length * passThreshold);
    const passed = score >= need;
    const pointsAwarded = passed ? quiz.pointsReward : 0;

    const attempt = await this.prisma.fandomQuizAttempt.create({
      data: {
        quizId,
        userId,
        score,
        totalQuestions: questions.length,
        pointsAwarded,
      },
    });

    if (passed && pointsAwarded > 0) {
      try {
        await this.loyaltyListener.onQuizCompleted(userId, quizId, pointsAwarded);
      } catch (e) {
        this.logger.warn(`Quiz loyalty credit: ${(e as Error).message}`);
      }
    }

    try {
      await this.segmentation.touchActivity(userId);
    } catch {
      /* non-fatal */
    }

    return {
      attemptId: attempt.id,
      score,
      totalQuestions: questions.length,
      passed,
      pointsAwarded,
      correctIndices: questions.map((q) => q.correctIndex),
    };
  }

  async myHistory(userId: string, limit = 20) {
    return this.prisma.fandomQuizAttempt.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      take: limit,
      include: {
        quiz: { select: { id: true, title: true, fandomId: true } },
      },
    });
  }

  async adminList() {
    return this.prisma.fandomQuiz.findMany({
      include: {
        fandom: { select: { name: true, slug: true } },
        _count: { select: { attempts: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async adminCreate(dto: CreateQuizDto) {
    const fandom = await this.prisma.fandom.findUnique({ where: { id: dto.fandomId } });
    if (!fandom) throw new BadRequestException('Invalid fandomId');

    for (const q of dto.questions) {
      if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
        throw new BadRequestException('Invalid correctIndex for a question');
      }
    }

    return this.prisma.fandomQuiz.create({
      data: {
        fandomId: dto.fandomId,
        title: dto.title,
        description: dto.description,
        questions: dto.questions as unknown as object[],
        pointsReward: dto.pointsReward ?? 25,
        difficulty: dto.difficulty ?? 'EASY',
        isActive: dto.isActive ?? true,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      },
      include: { fandom: { select: { name: true } } },
    });
  }

  async adminUpdate(id: string, patch: Partial<CreateQuizDto>) {
    const existing = await this.prisma.fandomQuiz.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Quiz not found');

    const data: Record<string, unknown> = {};
    if (patch.title != null) data.title = patch.title;
    if (patch.description !== undefined) data.description = patch.description;
    if (patch.pointsReward != null) data.pointsReward = patch.pointsReward;
    if (patch.difficulty != null) data.difficulty = patch.difficulty;
    if (patch.isActive != null) data.isActive = patch.isActive;
    if (patch.startsAt !== undefined) data.startsAt = patch.startsAt ? new Date(patch.startsAt) : null;
    if (patch.endsAt !== undefined) data.endsAt = patch.endsAt ? new Date(patch.endsAt) : null;
    if (patch.questions) {
      for (const q of patch.questions) {
        if (q.correctIndex < 0 || q.correctIndex >= q.options.length) {
          throw new BadRequestException('Invalid correctIndex');
        }
      }
      data.questions = patch.questions as unknown as object[];
    }
    if (patch.fandomId) {
      const f = await this.prisma.fandom.findUnique({ where: { id: patch.fandomId } });
      if (!f) throw new BadRequestException('Invalid fandomId');
      data.fandomId = patch.fandomId;
    }

    return this.prisma.fandomQuiz.update({
      where: { id },
      data: data as any,
      include: { fandom: { select: { name: true } } },
    });
  }

  async adminDeactivate(id: string) {
    await this.prisma.fandomQuiz.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async adminAttempts(quizId: string) {
    return this.prisma.fandomQuizAttempt.findMany({
      where: { quizId },
      orderBy: { completedAt: 'desc' },
      take: 100,
      include: { user: { select: { id: true, email: true, firstName: true } } },
    });
  }
}
