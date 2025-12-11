import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GeminiService } from '../ai/gemini.service';
import { KnowledgeBaseService } from './knowledge-base.service';

@Injectable()
export class ChatbotService {
  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
    private knowledgeBaseService: KnowledgeBaseService,
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
    // Search knowledge base for relevant articles
    const kbArticles = await this.knowledgeBaseService.searchArticles(data.message, {
      limit: 5,
    });

    // Build context for the AI
    const isSeller = !!data.sellerId;
    let contextPrompt = isSeller
      ? 'You are a helpful seller support assistant for an e-commerce marketplace. You help sellers with their accounts, products, orders, and platform features. '
      : 'You are a helpful customer support assistant for an e-commerce marketplace called "House of Spells" - a fandom merchandise marketplace. You help customers with orders, products, returns, payments, and account issues. ';
    
    if (data.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: data.userId },
        select: {
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });
      if (user) {
        contextPrompt += `The ${isSeller ? 'seller' : 'customer'} is ${user.firstName || ''} ${user.lastName || ''} (${user.email}). `;
      }
    }

    if (data.sellerId) {
      const seller = await this.prisma.seller.findUnique({
        where: { id: data.sellerId },
        select: {
          storeName: true,
          slug: true,
        },
      });
      if (seller) {
        contextPrompt += `The seller's store is "${seller.storeName}" (${seller.slug}). `;
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
        contextPrompt += `The ${isSeller ? 'seller' : 'customer'} is asking about order ${order.orderNumber} with ${order.items.length} items, total ${order.total} ${order.currency}. `;
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
        contextPrompt += `The ${isSeller ? 'seller' : 'customer'} is asking about product "${product.name}" (${product.price} ${product.currency}, stock: ${product.stock}). `;
      }
    }

    // Add knowledge base context
    let kbContext = '';
    if (kbArticles && kbArticles.length > 0) {
      kbContext = '\n\nRelevant Knowledge Base Articles:\n';
      kbArticles.forEach((article: any, index: number) => {
        kbContext += `${index + 1}. ${article.title} (Category: ${article.category})\n`;
        kbContext += `   ${article.content.substring(0, 200)}...\n\n`;
      });
      contextPrompt += 'Use the knowledge base articles provided to answer questions accurately. If the knowledge base has relevant information, prioritize it in your response.';
    }

    // Get conversation history if conversationId exists
    let conversationHistory = '';
    let messages: Array<{ role: string; content: string }> = [];
    
    if (data.conversationId) {
      // For now, we'll use a simple in-memory approach
      // In production, you can implement proper conversation storage
      // For now, we'll indicate that conversation context is available
      conversationHistory = 'Previous conversation context available.';
      
      // TODO: Implement proper conversation storage using a database table
      // This could be done with a SupportConversation model in Prisma
    }

    // Add current message
    messages.push({ role: 'user', content: data.message });

    // Build the full system prompt with knowledge base
    const systemPrompt = `${contextPrompt}${kbContext}\n\n${conversationHistory}\n\nInstructions:\n- Provide helpful, accurate, and concise responses.\n- Reference knowledge base articles when relevant.\n- If you cannot help with the question, suggest creating a support ticket or escalating to a human agent.\n- Be friendly, professional, and empathetic.\n- For seller questions, focus on seller-specific features like product submissions, orders, analytics, and store management.\n- For customer questions, focus on shopping, orders, returns, payments, and account management.`;

    // Get AI response
    const aiResponse = await this.geminiService.generateChatResponse(
      messages,
      systemPrompt,
      {
        knowledgeBaseArticles: kbArticles.map((a: any) => ({
          title: a.title,
          category: a.category,
          excerpt: a.content.substring(0, 300),
        })),
      },
    );

    // Store conversation if conversationId exists
    // TODO: Implement proper conversation storage
    // For now, conversation history is maintained in the frontend
    // In production, implement a SupportConversation model in Prisma

    // Check if escalation is needed
    const needsEscalation = this.shouldEscalate(aiResponse, data.message);

    // Extract referenced articles
    const referencedArticles = kbArticles.slice(0, 3).map((a: any) => ({
      id: a.id,
      title: a.title,
      slug: a.slug,
      category: a.category,
    }));

    return {
      response: aiResponse,
      needsEscalation,
      conversationId: data.conversationId,
      knowledgeBaseArticles: referencedArticles,
      suggestedActions: this.extractSuggestedActions(aiResponse, data.message),
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
    // TODO: Implement proper conversation history retrieval
    // For now, return empty array - history is maintained in frontend
    // In production, implement a SupportConversation model in Prisma
    return [];
  }

  async createConversation(userId?: string, sellerId?: string): Promise<string> {
    // Generate a unique conversation ID
    // In production, you can store this in a database table
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // TODO: Implement proper conversation storage using a database table
    // This could be done with a SupportConversation model in Prisma
    
    return conversationId;
  }

  private extractSuggestedActions(aiResponse: string, userMessage: string): string[] {
    const actions: string[] = [];
    const lowerResponse = aiResponse.toLowerCase();
    const lowerMessage = userMessage.toLowerCase();

    // Check for common action triggers
    if (lowerMessage.includes('order') || lowerResponse.includes('order')) {
      actions.push('view_orders');
    }
    if (lowerMessage.includes('return') || lowerResponse.includes('return')) {
      actions.push('create_return');
    }
    if (lowerMessage.includes('payment') || lowerResponse.includes('payment')) {
      actions.push('view_payments');
    }
    if (lowerMessage.includes('product') || lowerResponse.includes('product')) {
      actions.push('browse_products');
    }
    if (lowerMessage.includes('account') || lowerResponse.includes('account')) {
      actions.push('view_profile');
    }
    if (lowerResponse.includes('ticket') || lowerResponse.includes('support ticket')) {
      actions.push('create_ticket');
    }

    return actions;
  }
}

