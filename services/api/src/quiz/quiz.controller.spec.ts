import { Test } from '@nestjs/testing';
import { QuizController } from './quiz.controller';
import { QuizService } from './quiz.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('QuizController', () => {
  it('list delegates to service', async () => {
    const mockQuiz = { listQuizzes: jest.fn().mockResolvedValue([{ id: '1' }]) };
    const moduleRef = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [{ provide: QuizService, useValue: mockQuiz }],
    }).compile();
    const ctrl = moduleRef.get(QuizController);
    const r = await ctrl.list();
    expect(r.data).toEqual([{ id: '1' }]);
    expect(mockQuiz.listQuizzes).toHaveBeenCalledWith(undefined);
  });

  it('list filters by fandomId query param', async () => {
    const mockQuiz = { listQuizzes: jest.fn().mockResolvedValue([]) };
    const moduleRef = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [{ provide: QuizService, useValue: mockQuiz }],
    }).compile();
    const ctrl = moduleRef.get(QuizController);
    await ctrl.list('fandom-123');
    expect(mockQuiz.listQuizzes).toHaveBeenCalledWith('fandom-123');
  });

  it('submit passes user id', async () => {
    const mockQuiz = { submitQuiz: jest.fn().mockResolvedValue({ passed: true }) };
    const moduleRef = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [{ provide: QuizService, useValue: mockQuiz }],
    }).compile();
    const ctrl = moduleRef.get(QuizController);
    await ctrl.submit({ user: { id: 'u1' } }, 'q1', { answers: [0, 1] });
    expect(mockQuiz.submitQuiz).toHaveBeenCalledWith('u1', 'q1', [0, 1]);
  });

  it('submit propagates BadRequestException from service', async () => {
    const mockQuiz = {
      submitQuiz: jest.fn().mockRejectedValue(new BadRequestException('Weekly quiz attempt limit reached')),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [{ provide: QuizService, useValue: mockQuiz }],
    }).compile();
    const ctrl = moduleRef.get(QuizController);
    await expect(ctrl.submit({ user: { id: 'u1' } }, 'q1', { answers: [0] })).rejects.toThrow(BadRequestException);
  });

  it('one() propagates NotFoundException from service', async () => {
    const mockQuiz = {
      getQuizForPlayer: jest.fn().mockRejectedValue(new NotFoundException('Quiz not found')),
    };
    const moduleRef = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [{ provide: QuizService, useValue: mockQuiz }],
    }).compile();
    const ctrl = moduleRef.get(QuizController);
    await expect(ctrl.one('no-such-id')).rejects.toThrow(NotFoundException);
  });

  it('history delegates to service', async () => {
    const mockQuiz = { myHistory: jest.fn().mockResolvedValue([{ id: 'a1', score: 5 }]) };
    const moduleRef = await Test.createTestingModule({
      controllers: [QuizController],
      providers: [{ provide: QuizService, useValue: mockQuiz }],
    }).compile();
    const ctrl = moduleRef.get(QuizController);
    const r = await ctrl.history({ user: { id: 'u1' } });
    expect(r.data).toHaveLength(1);
    expect(mockQuiz.myHistory).toHaveBeenCalledWith('u1');
  });
});
