import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppService {
  private twilioAccountSid: string;
  private twilioAuthToken: string;
  private twilioWhatsAppNumber: string;
  private useTwilio: boolean;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.twilioAccountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID') || '';
    this.twilioAuthToken = this.configService.get<string>('TWILIO_AUTH_TOKEN') || '';
    this.twilioWhatsAppNumber = this.configService.get<string>('TWILIO_WHATSAPP_NUMBER') || '';
    this.useTwilio = !!(this.twilioAccountSid && this.twilioAuthToken && this.twilioWhatsAppNumber);
  }

  async sendMessage(data: {
    to: string;
    message: string;
    mediaUrl?: string;
    userId?: string;
    sellerId?: string;
    ticketId?: string;
  }) {
    // Get or create conversation
    let conversation = await this.prisma.whatsAppConversation.findFirst({
      where: {
        phoneNumber: data.to,
        status: 'ACTIVE',
      },
    });

    if (!conversation) {
      conversation = await this.prisma.whatsAppConversation.create({
        data: {
          phoneNumber: data.to,
          userId: data.userId,
          sellerId: data.sellerId,
          ticketId: data.ticketId,
          status: 'ACTIVE',
        },
      });
    }

    // Send message via Twilio (if configured)
    let messageId: string;
    let status: 'SENT' | 'FAILED' = 'SENT';

    if (this.useTwilio) {
      try {
        const twilio = require('twilio');
        const client = twilio(this.twilioAccountSid, this.twilioAuthToken);

        const twilioMessage = await client.messages.create({
          from: `whatsapp:${this.twilioWhatsAppNumber}`,
          to: `whatsapp:${data.to}`,
          body: data.message,
          mediaUrl: data.mediaUrl ? [data.mediaUrl] : undefined,
        });

        messageId = twilioMessage.sid;
      } catch (error: any) {
        console.error('Twilio WhatsApp send error:', error);
        status = 'FAILED';
        messageId = `failed-${Date.now()}`;
      }
    } else {
      // Fallback: log message (for development/testing)
      console.log(`📱 WhatsApp message (not sent - Twilio not configured):`);
      console.log(`   To: ${data.to}`);
      console.log(`   Message: ${data.message}`);
      messageId = `mock-${Date.now()}`;
    }

    // Store message in database
    const message = await this.prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        messageId,
        direction: 'OUTBOUND',
        content: data.message,
        mediaUrl: data.mediaUrl,
        status,
        deliveredAt: status === 'SENT' ? new Date() : undefined,
      },
    });

    // Update conversation last message time
    await this.prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
    });

    return message;
  }

  async handleWebhook(data: {
    From: string;
    To: string;
    Body: string;
    MessageSid: string;
    MediaUrl0?: string;
  }) {
    const phoneNumber = data.From.replace('whatsapp:', '');
    const messageContent = data.Body || '';
    const messageId = data.MessageSid;

    // Get or create conversation
    let conversation = await this.prisma.whatsAppConversation.findFirst({
      where: {
        phoneNumber,
        status: 'ACTIVE',
      },
    });

    if (!conversation) {
      // Try to find user by phone number
      const user = await this.prisma.user.findFirst({
        where: {
          whatsappNumber: phoneNumber,
        },
      });

      // Try to find seller by phone number
      const seller = await this.prisma.seller.findFirst({
        where: {
          user: {
            whatsappNumber: phoneNumber,
          },
        },
      });

      conversation = await this.prisma.whatsAppConversation.create({
        data: {
          phoneNumber,
          userId: user?.id,
          sellerId: seller?.id,
          status: 'ACTIVE',
        },
      });
    }

    // Store incoming message
    const message = await this.prisma.whatsAppMessage.create({
      data: {
        conversationId: conversation.id,
        messageId,
        direction: 'INBOUND',
        content: messageContent,
        mediaUrl: data.MediaUrl0,
        status: 'DELIVERED',
        deliveredAt: new Date(),
      },
    });

    // Update conversation
    await this.prisma.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
      },
    });

    // Auto-create ticket if linked to support
    if (conversation.ticketId) {
      // Add message to existing ticket
      // This would be handled by the tickets service
    } else if (
      messageContent.toLowerCase().includes('support') ||
      messageContent.toLowerCase().includes('help')
    ) {
      // Auto-create ticket for support requests
      // This would be handled by the tickets service
    }

    return message;
  }

  async getConversations(filters?: {
    userId?: string;
    sellerId?: string;
    ticketId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const where: any = {};

    if (filters?.userId) {
      where.userId = filters.userId;
    }

    if (filters?.sellerId) {
      where.sellerId = filters.sellerId;
    }

    if (filters?.ticketId) {
      where.ticketId = filters.ticketId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const [conversations, total] = await Promise.all([
      this.prisma.whatsAppConversation.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          seller: {
            select: {
              id: true,
              storeName: true,
              slug: true,
            },
          },
          ticket: {
            select: {
              id: true,
              ticketNumber: true,
              subject: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: {
          lastMessageAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.whatsAppConversation.count({ where }),
    ]);

    return {
      conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getConversationMessages(
    conversationId: string,
    filters?: {
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 50;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.prisma.whatsAppMessage.findMany({
        where: { conversationId },
        orderBy: {
          createdAt: 'asc',
        },
        skip,
        take: limit,
      }),
      this.prisma.whatsAppMessage.count({ where: { conversationId } }),
    ]);

    return {
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async createTemplate(data: {
    name: string;
    category: string;
    content: string;
    variables?: string[];
    approvedBy?: string;
  }) {
    return this.prisma.whatsAppTemplate.create({
      data: {
        name: data.name,
        category: data.category,
        content: data.content,
        variables: data.variables || [],
        isActive: true,
        approvedBy: data.approvedBy,
      },
    });
  }

  async getTemplates(filters?: { category?: string; isActive?: boolean }) {
    const where: any = {};

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    return this.prisma.whatsAppTemplate.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async sendTemplateMessage(data: {
    to: string;
    templateName: string;
    variables: Record<string, string>;
  }) {
    const template = await this.prisma.whatsAppTemplate.findUnique({
      where: { name: data.templateName },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (!template.isActive) {
      throw new BadRequestException('Template is not active');
    }

    // Replace template variables
    let message = template.content;
    template.variables.forEach((variable) => {
      const value = data.variables[variable] || '';
      message = message.replace(new RegExp(`{{${variable}}}`, 'g'), value);
    });

    return this.sendMessage({
      to: data.to,
      message,
    });
  }
}
