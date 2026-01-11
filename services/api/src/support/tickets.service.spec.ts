import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { PrismaService } from '../database/prisma.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    supportTicket: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    ticketMessage: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TicketsService>(TicketsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('generateTicketNumber', () => {
    it('should generate a unique ticket number', async () => {
      const ticketNumber = await service.generateTicketNumber();

      expect(ticketNumber).toMatch(/^TKT-/);
      expect(ticketNumber.length).toBeGreaterThan(10);
    });
  });

  describe('createTicket', () => {
    const ticketData = {
      userId: 'user-1',
      subject: 'Test Ticket',
      category: 'ORDER_INQUIRY' as const,
      priority: 'HIGH' as const,
      initialMessage: 'I need help with my order',
    };

    it('should create a ticket successfully', async () => {
      const mockTicket = {
        id: 'ticket-1',
        ticketNumber: 'TKT-123',
        ...ticketData,
        status: 'OPEN',
        slaDueAt: expect.any(Date),
        messages: [{ id: 'msg-1', content: ticketData.initialMessage }],
      };

      mockPrismaService.supportTicket.create.mockResolvedValue(mockTicket);

      const result = await service.createTicket(ticketData);

      expect(mockPrismaService.supportTicket.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('ticketNumber');
      expect(result.status).toBe('OPEN');
    });

    it('should set SLA due date based on priority', async () => {
      const urgentData = { ...ticketData, priority: 'URGENT' as const };
      const mockTicket = {
        id: 'ticket-1',
        ticketNumber: 'TKT-123',
        ...urgentData,
        slaDueAt: new Date(),
      };

      mockPrismaService.supportTicket.create.mockResolvedValue(mockTicket);

      await service.createTicket(urgentData);

      const callArgs = mockPrismaService.supportTicket.create.mock.calls[0][0];
      const slaDueAt = callArgs.data.slaDueAt;
      const hoursFromNow = (slaDueAt.getTime() - new Date().getTime()) / (1000 * 60 * 60);
      
      expect(hoursFromNow).toBeCloseTo(24, 0); // URGENT = 24 hours
    });
  });

  describe('getTickets', () => {
    it('should return tickets with filters', async () => {
      const mockTickets = [
        { id: 'ticket-1', subject: 'Test 1', status: 'OPEN' },
        { id: 'ticket-2', subject: 'Test 2', status: 'RESOLVED' },
      ];

      mockPrismaService.supportTicket.findMany.mockResolvedValue(mockTickets);
      mockPrismaService.supportTicket.count.mockResolvedValue(2);

      const result = await service.getTickets({
        status: 'OPEN',
        page: 1,
        limit: 10,
      });

      expect(result).toHaveProperty('tickets');
      expect(result).toHaveProperty('pagination');
      expect(result.tickets).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it('should handle pagination correctly', async () => {
      mockPrismaService.supportTicket.findMany.mockResolvedValue([]);
      mockPrismaService.supportTicket.count.mockResolvedValue(100);

      const result = await service.getTickets({ page: 2, limit: 20 });

      expect(result.pagination.page).toBe(2);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.totalPages).toBe(5);
    });
  });

  describe('getTicketById', () => {
    it('should return ticket by id', async () => {
      const ticketId = 'ticket-1';
      const mockTicket = {
        id: ticketId,
        subject: 'Test Ticket',
        messages: [],
      };

      mockPrismaService.supportTicket.findUnique.mockResolvedValue(mockTicket);

      const result = await service.getTicketById(ticketId);

      expect(mockPrismaService.supportTicket.findUnique).toHaveBeenCalledWith({
        where: { id: ticketId },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockTicket);
    });

    it('should throw NotFoundException if ticket not found', async () => {
      mockPrismaService.supportTicket.findUnique.mockResolvedValue(null);

      await expect(service.getTicketById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateTicket', () => {
    it('should update ticket successfully', async () => {
      const ticketId = 'ticket-1';
      const updateData = {
        subject: 'Updated Subject',
        status: 'RESOLVED',
      };
      const mockTicket = {
        id: ticketId,
        ...updateData,
      };

      mockPrismaService.supportTicket.findUnique.mockResolvedValue({ id: ticketId });
      mockPrismaService.supportTicket.update.mockResolvedValue(mockTicket);

      const result = await service.updateTicket(ticketId, updateData);

      expect(mockPrismaService.supportTicket.update).toHaveBeenCalled();
      expect(result).toEqual(mockTicket);
    });

    it('should throw NotFoundException if ticket not found', async () => {
      mockPrismaService.supportTicket.findUnique.mockResolvedValue(null);

      await expect(service.updateTicket('non-existent', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addMessage', () => {
    it('should add message to ticket', async () => {
      const ticketId = 'ticket-1';
      const messageData = {
        userId: 'user-1',
        content: 'This is a reply',
      };
      const mockTicket = {
        id: ticketId,
        status: 'OPEN',
      };
      const mockMessage = {
        id: 'msg-1',
        ...messageData,
      };

      mockPrismaService.supportTicket.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.ticketMessage.create.mockResolvedValue(mockMessage);
      mockPrismaService.ticketMessage.findUnique.mockResolvedValue(mockMessage);

      const result = await service.addMessage(ticketId, messageData);

      expect(mockPrismaService.ticketMessage.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });

    it('should update ticket status to IN_PROGRESS when user replies', async () => {
      const ticketId = 'ticket-1';
      const messageData = {
        userId: 'user-1',
        content: 'Reply',
      };
      const mockTicket = {
        id: ticketId,
        status: 'OPEN',
      };

      mockPrismaService.supportTicket.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.ticketMessage.create.mockResolvedValue({ id: 'msg-1' });
      mockPrismaService.ticketMessage.findUnique.mockResolvedValue({ id: 'msg-1' });
      mockPrismaService.supportTicket.update.mockResolvedValue({
        ...mockTicket,
        status: 'IN_PROGRESS',
      });

      await service.addMessage(ticketId, messageData);

      expect(mockPrismaService.supportTicket.update).toHaveBeenCalledWith({
        where: { id: ticketId },
        data: { status: 'IN_PROGRESS' },
      });
    });
  });

  describe('assignTicket', () => {
    it('should assign ticket to agent', async () => {
      const ticketId = 'ticket-1';
      const agentId = 'agent-1';
      const mockTicket = { id: ticketId };
      const mockAgent = { id: agentId, email: 'agent@example.com' };

      mockPrismaService.supportTicket.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.user.findUnique.mockResolvedValue(mockAgent);
      mockPrismaService.supportTicket.update.mockResolvedValue({
        ...mockTicket,
        assignedTo: agentId,
        status: 'ASSIGNED',
      });

      const result = await service.assignTicket(ticketId, agentId);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: agentId },
      });
      expect(result.status).toBe('ASSIGNED');
    });

    it('should throw NotFoundException if ticket not found', async () => {
      mockPrismaService.supportTicket.findUnique.mockResolvedValue(null);

      await expect(service.assignTicket('non-existent', 'agent-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if agent not found', async () => {
      mockPrismaService.supportTicket.findUnique.mockResolvedValue({ id: 'ticket-1' });
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.assignTicket('ticket-1', 'non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateTicketStatus', () => {
    it('should update ticket status', async () => {
      const ticketId = 'ticket-1';
      const status = 'RESOLVED';
      const mockTicket = { id: ticketId, status: 'OPEN' };

      mockPrismaService.supportTicket.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.supportTicket.update.mockResolvedValue({
        ...mockTicket,
        status,
        resolvedAt: expect.any(Date),
      });

      const result = await service.updateTicketStatus(ticketId, status);

      expect(result.status).toBe(status);
      expect(result).toHaveProperty('resolvedAt');
    });

    it('should set resolvedAt when status is RESOLVED or CLOSED', async () => {
      const ticketId = 'ticket-1';
      const mockTicket = { id: ticketId };

      mockPrismaService.supportTicket.findUnique.mockResolvedValue(mockTicket);
      mockPrismaService.supportTicket.update.mockResolvedValue({
        ...mockTicket,
        status: 'CLOSED',
        resolvedAt: new Date(),
      });

      const result = await service.updateTicketStatus(ticketId, 'CLOSED');

      expect(result).toHaveProperty('resolvedAt');
    });
  });
});
