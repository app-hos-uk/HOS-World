import { QuizService } from './quiz.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('QuizService', () => {
  const questions = [
    { question: 'Q1', options: ['a', 'b', 'c', 'd'], correctIndex: 0 },
    { question: 'Q2', options: ['a', 'b', 'c', 'd'], correctIndex: 1 },
  ];

  function makeService(overrides: Partial<any> = {}) {
    const prisma: any = {
      fandomQuiz: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'new' }),
        update: jest.fn(),
      },
      fandomQuizAttempt: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({ id: 'att1' }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      fandom: { findUnique: jest.fn().mockResolvedValue({ id: 'f1', name: 'HP' }) },
      ...overrides,
    };
    const config: any = {
      get: jest.fn((k: string, def?: number) => {
        if (k === 'QUIZ_MAX_PER_WEEK') return 2;
        if (k === 'QUIZ_PASS_THRESHOLD') return def ?? 0.5;
        return def;
      }),
    };
    const listener: any = {
      onQuizCompleted: jest.fn().mockResolvedValue(25),
    };
    const segmentation = { touchActivity: jest.fn().mockResolvedValue(undefined) };
    const svc = new QuizService(prisma, config, listener, segmentation as any);
    return { svc, prisma, listener };
  }

  it('submitQuiz throws when weekly limit exceeded', async () => {
    const { svc, prisma } = makeService();
    prisma.fandomQuiz.findFirst.mockResolvedValue({
      id: 'q1',
      isActive: true,
      questions,
      pointsReward: 25,
    });
    prisma.fandomQuizAttempt.count.mockResolvedValue(2);
    await expect(svc.submitQuiz('u1', 'q1', [0, 1])).rejects.toThrow(BadRequestException);
  });

  it('submitQuiz passes at 50% threshold', async () => {
    const { svc, prisma, listener } = makeService();
    prisma.fandomQuiz.findFirst.mockResolvedValue({
      id: 'q1',
      isActive: true,
      questions,
      pointsReward: 25,
    });
    prisma.fandomQuizAttempt.count.mockResolvedValue(0);
    const r = await svc.submitQuiz('u1', 'q1', [0, 1]);
    expect(r.passed).toBe(true);
    expect(r.pointsAwarded).toBe(25);
    expect(listener.onQuizCompleted).toHaveBeenCalledWith('u1', 'q1', 25);
  });

  it('submitQuiz fails below threshold', async () => {
    const { svc, prisma, listener } = makeService();
    prisma.fandomQuiz.findFirst.mockResolvedValue({
      id: 'q1',
      isActive: true,
      questions,
      pointsReward: 25,
    });
    const r = await svc.submitQuiz('u1', 'q1', [1, 0]);
    expect(r.passed).toBe(false);
    expect(r.pointsAwarded).toBe(0);
    expect(listener.onQuizCompleted).not.toHaveBeenCalled();
  });

  it('getQuizForPlayer strips answers', async () => {
    const { svc, prisma } = makeService();
    prisma.fandomQuiz.findFirst.mockResolvedValue({
      id: 'q1',
      title: 'T',
      description: null,
      difficulty: 'EASY',
      pointsReward: 10,
      questions,
      fandom: { name: 'HP' },
    });
    const r = await svc.getQuizForPlayer('q1');
    expect(r.questions[0]).not.toHaveProperty('correctIndex');
    expect(r.questions[0].options).toEqual(['a', 'b', 'c', 'd']);
  });

  it('getQuizForPlayer throws when quiz missing', async () => {
    const { svc, prisma } = makeService();
    prisma.fandomQuiz.findFirst.mockResolvedValue(null);
    await expect(svc.getQuizForPlayer('missing')).rejects.toThrow(NotFoundException);
  });

  it('listQuizzes filters by fandomId', async () => {
    const { svc, prisma } = makeService();
    prisma.fandomQuiz.findMany.mockResolvedValue([]);
    await svc.listQuizzes('fandom-1');
    expect(prisma.fandomQuiz.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fandomId: 'fandom-1' }),
      }),
    );
  });

  it('submitQuiz rejects wrong answer count', async () => {
    const { svc, prisma } = makeService();
    prisma.fandomQuiz.findFirst.mockResolvedValue({
      id: 'q1',
      isActive: true,
      questions,
      pointsReward: 25,
    });
    prisma.fandomQuizAttempt.count.mockResolvedValue(0);
    await expect(svc.submitQuiz('u1', 'q1', [0])).rejects.toThrow(BadRequestException);
  });

  it('adminCreate rejects unknown fandom', async () => {
    const { svc, prisma } = makeService();
    prisma.fandom.findUnique.mockResolvedValue(null);
    await expect(
      svc.adminCreate({
        fandomId: 'nope',
        title: 'T',
        questions: [{ question: 'Q', options: ['a', 'b'], correctIndex: 0 }],
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});
