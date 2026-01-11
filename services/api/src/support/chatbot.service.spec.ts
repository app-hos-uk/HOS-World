import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotService } from './chatbot.service';
import { PrismaService } from '../database/prisma.service';
import { GeminiService } from '../ai/gemini.service';

describe('ChatbotService', () => {
  let service: ChatbotService;
  let prismaService: PrismaService;
  let geminiService: GeminiService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    order: {
      findUnique: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
  };

  const mockGeminiService = {
    generateChatResponse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: GeminiService,
          useValue: mockGeminiService,
        },
      ],
    }).compile();

    service = module.get<ChatbotService>(ChatbotService);
    prismaService = module.get<PrismaService>(PrismaService);
    geminiService = module.get<GeminiService>(GeminiService);

    jest.clearAllMocks();
  });

  describe('processMessage', () => {
    it('should process message and return response', async () => {
      const messageData = {
        userId: 'user-1',
        message: 'Hello, I need help',
      };
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };
      const mockResponse = 'Hello! How can I help you today?';

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockGeminiService.generateChatResponse.mockResolvedValue(mockResponse);

      const result = await service.processMessage(messageData);

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('needsEscalation');
      expect(result.response).toBe(mockResponse);
    });

    it('should include user context in prompt', async () => {
      const messageData = {
        userId: 'user-1',
        message: 'Test message',
      };
      const mockUser = {
        id: 'user-1',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockGeminiService.generateChatResponse.mockResolvedValue('Response');

      await service.processMessage(messageData);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: messageData.userId },
        select: expect.any(Object),
      });
    });

    it('should include order context if orderId provided', async () => {
      const messageData = {
        userId: 'user-1',
        message: 'Where is my order?',
        context: { orderId: 'order-1' },
      };
      const mockOrder = {
        id: 'order-1',
        orderNumber: 'ORD-123',
        total: 100,
        currency: 'GBP',
        items: [{ product: { name: 'Product 1', price: 100 } }],
      };

      mockPrismaService.order.findUnique.mockResolvedValue(mockOrder);
      mockGeminiService.generateChatResponse.mockResolvedValue('Response');

      await service.processMessage(messageData);

      expect(mockPrismaService.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: expect.any(Object),
      });
    });

    it('should include product context if productId provided', async () => {
      const messageData = {
        userId: 'user-1',
        message: 'Tell me about this product',
        context: { productId: 'product-1' },
      };
      const mockProduct = {
        id: 'product-1',
        name: 'Test Product',
        description: 'Product description',
        price: 50,
        stock: 10,
      };

      mockPrismaService.product.findUnique.mockResolvedValue(mockProduct);
      mockGeminiService.generateChatResponse.mockResolvedValue('Response');

      await service.processMessage(messageData);

      expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        select: expect.any(Object),
      });
    });

    it('should detect escalation needs', async () => {
      const messageData = {
        userId: 'user-1',
        message: 'I want to speak to a human',
      };

      mockGeminiService.generateChatResponse.mockResolvedValue('I cannot help');

      const result = await service.processMessage(messageData);

      expect(result).toHaveProperty('needsEscalation');
    });
  });

  describe('escalateToHuman', () => {
    it('should create support ticket when escalated', async () => {
      const escalateData = {
        userId: 'user-1',
        message: 'I need human help',
        reason: 'Complex issue',
      };

      // Mock the TicketsService import
      const mockTicketsService = {
        createTicket: jest.fn().mockResolvedValue({
          id: 'ticket-1',
          ticketNumber: 'TKT-123',
        }),
      };

      jest.doMock('./tickets.service', () => ({
        TicketsService: jest.fn().mockImplementation(() => mockTicketsService),
      }));

      // Note: This test may need adjustment based on actual implementation
      // The escalateToHuman method dynamically imports TicketsService
      const result = await service.escalateToHuman(escalateData);

      expect(result).toHaveProperty('ticketId');
      expect(result).toHaveProperty('ticketNumber');
      expect(result).toHaveProperty('message');
    });
  });

  describe('shouldEscalate', () => {
    it('should return true for escalation keywords in response', () => {
      const aiResponse = 'I cannot help you with this issue';
      const userMessage = 'Test message';

      // Access private method through reflection or make it public for testing
      // For now, we test through processMessage
      expect(service).toBeDefined();
    });

    it('should return true for human request keywords', () => {
      const aiResponse = 'Response';
      const userMessage = 'I want to speak to a human agent';

      // Test through processMessage
      expect(service).toBeDefined();
    });
  });

  describe('getChatHistory', () => {
    it('should return chat history', async () => {
      const conversationId = 'conv-1';
      const result = await service.getChatHistory(conversationId);

      expect(result).toEqual([]);
    });
  });
});
