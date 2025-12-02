import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { GeminiService } from './gemini.service';
import { SendChatMessageDto } from './dto/send-chat-message.dto';

@Injectable()
export class AIChatService {
  constructor(
    private prisma: PrismaService,
    private geminiService: GeminiService,
  ) {}

  async sendMessage(
    userId: string,
    characterId: string,
    dto: SendChatMessageDto,
  ): Promise<any> {
    // Get character and user
    const [character, user] = await Promise.all([
      this.prisma.character.findUnique({
        where: { id: characterId },
        include: { fandom: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
      }),
    ]);

    if (!character || !user) {
      throw new NotFoundException('Character or user not found');
    }

    // Get or create chat history
    let chat = await this.prisma.aIChat.findFirst({
      where: {
        userId,
        characterId,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!chat) {
      chat = await this.prisma.aIChat.create({
        data: {
          userId,
          characterId,
          messages: [],
          context: {
            favoriteFandoms: user.favoriteFandoms || [],
            characterName: character.name,
            fandom: character.fandom.name,
          },
        },
      });
    }

    const messages = (chat.messages as any[]) || [];
    messages.push({
      role: 'user',
      content: dto.message,
      timestamp: new Date().toISOString(),
    });

    // Generate AI response
    const systemPrompt = this.buildSystemPrompt(character, user);
    const context = chat.context || {};

    const aiResponse = await this.geminiService.generateChatResponse(
      messages,
      systemPrompt,
      context,
    );

    messages.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date().toISOString(),
    });

    // Update chat
    await this.prisma.aIChat.update({
      where: { id: chat.id },
      data: {
        messages,
        updatedAt: new Date(),
      },
    });

    // Check for product recommendations in response
    const productRecommendations = await this.extractProductRecommendations(aiResponse);

    return {
      response: aiResponse,
      character: {
        id: character.id,
        name: character.name,
        avatar: character.avatar,
        fandom: character.fandom.name,
      },
      productRecommendations,
    };
  }

  async getChatHistory(userId: string, characterId?: string): Promise<any[]> {
    const where: any = { userId };
    if (characterId) {
      where.characterId = characterId;
    }

    return this.prisma.aIChat.findMany({
      where,
      include: {
        character: {
          include: {
            fandom: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private buildSystemPrompt(character: any, user: any): string {
    const personality = JSON.parse(character.personality || '{}');
    
    return `You are ${character.name} from ${character.fandom.name}.
Your personality traits: ${JSON.stringify(personality)}
You work at House of Spells Marketplace, helping fans discover magical products.

User's favorite fandoms: ${(user.favoriteFandoms || []).join(', ')}

Guidelines:
- Stay in character at all times
- Be enthusiastic and helpful
- Recommend products when relevant
- Ask questions to understand user needs
- Keep responses concise (2-3 sentences max)
- Use fandom-specific references naturally`;
  }

  private async extractProductRecommendations(message: string): Promise<any[]> {
    // Extract product mentions or keywords from AI response
    const keywords = message.match(/wand|robe|potion|book|crystal|spell/i);
    
    if (keywords) {
      // Search for products matching keywords
      return this.prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { name: { contains: keywords[0], mode: 'insensitive' } },
            { description: { contains: keywords[0], mode: 'insensitive' } },
            { tags: { has: keywords[0] } },
          ],
        },
        take: 3,
        include: {
          images: {
            take: 1,
          },
        },
      });
    }

    return [];
  }
}

