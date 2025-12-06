import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GeminiService } from '../ai/gemini.service';

@Injectable()
export class ChatbotService {
  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
  ) {}

  async processMessage(data: {
    userId?: string;
    sellerId?: string;
    message: string;
    conversationId?: string;
    context?: {
      orderId?: string;
      productId?: string;
      ticketId?: string;
    };
  }) {
    // Build context for the AI
    let contextPrompt = 'You are a helpful customer support assistant for an e-commerce marketplace. ';
    
    if (data.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: {
          email: true,
          firstName: true,
          lastName: true,
        },
      });
      if (user) {
        contextPrompt += `The customer is ${user.firstName || ''} ${user.lastName || ''} (${user.email}). `;
      }
    }

    if (data.context?.orderId) {
      const order = await this.prisma.order.findUnique({
        where: { id: data.context.orderId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
      });
      if (order) {
        contextPrompt += `The customer is asking about order ${order.orderNumber} with ${order.items.length} items, total ${order.total} ${order.currency}. `;
      }
    }

    if (data.context?.productId) {
      const product = await this.prisma.product.findUnique({
        where: { id: data.context.productId },
        select: {
          name: true,
          description: true,
          price: true,
          stock: true,
        },
      });
      if (product) {
        contextPrompt += `The customer is asking about product "${product.name}" (${product.price} ${product.currency}, stock: ${product.stock}). `;
      }
    }

    // Get conversation history if conversationId exists
    let conversationHistory = '';
    if (data.conversationId) {
      // In a real implementation, you'd fetch previous messages
      // For now, we'll use a simple approach
      conversationHistory = 'Previous conversation context available.';
    }

    // Build the full prompt
    const fullPrompt = `${contextPrompt}\n\n${conversationHistory}\n\nCustomer question: ${data.message}\n\nPlease provide a helpful, concise response. If you cannot help, suggest escalating to a human agent.`;

    // Get AI response
    const aiResponse = await this.geminiService.generateChatResponse(
      [{ role: 'user', content: data.message }],
      contextPrompt + conversationHistory,
    );

    // Check if escalation is needed
    const needsEscalation = this.shouldEscalate(aiResponse, data.message);

    return {
      response: aiResponse,
      needsEscalation,
      conversationId: data.conversationId,
    };
  }

  async escalateToHuman(data: {
    userId?: string;
    sellerId?: string;
    message: string;
    conversationId?: string;
    reason?: string;
  }) {
    // Create a support ticket from the chatbot conversation
    const ticketsService = new (await import('./tickets.service')).TicketsService(
      this.prisma,
    );

    const ticket = await ticketsService.createTicket({
      userId: data.userId,
      sellerId: data.sellerId,
      subject: 'Escalated from AI Chatbot',
      category: 'TECHNICAL_SUPPORT',
      priority: 'MEDIUM',
      initialMessage: `Chatbot conversation escalated.\n\nReason: ${data.reason || 'AI unable to resolve'}\n\nCustomer message: ${data.message}`,
    });

    return {
      ticketId: ticket.id,
      ticketNumber: ticket.ticketNumber,
      message: 'Your conversation has been escalated to a human agent. A support ticket has been created.',
    };
  }

  private shouldEscalate(aiResponse: string, userMessage: string): boolean {
    // Simple heuristics for escalation
    const escalationKeywords = [
      'cannot help',
      'unable to',
      'please contact',
      'escalate',
      'human agent',
      'speak to someone',
    ];

    const lowerResponse = aiResponse.toLowerCase();
    const lowerMessage = userMessage.toLowerCase();

    // Check if AI response suggests escalation
    if (escalationKeywords.some((keyword) => lowerResponse.includes(keyword))) {
      return true;
    }

    // Check if user is asking for human
    const humanRequestKeywords = [
      'speak to human',
      'talk to agent',
      'real person',
      'human support',
      'customer service',
    ];

    if (humanRequestKeywords.some((keyword) => lowerMessage.includes(keyword))) {
      return true;
    }

    return false;
  }

  async getChatHistory(conversationId: string) {
    // In a real implementation, you'd store and retrieve chat history
    // For now, return empty array
    return [];
  }
}

