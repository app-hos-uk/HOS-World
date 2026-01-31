import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Using fetch for Gemini API (Node.js 18+ has native fetch)
// For Node.js < 18, you can use node-fetch package

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private apiKey: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';

    if (!this.apiKey) {
      this.logger.warn('GEMINI_API_KEY not configured. AI features will use fallback responses.');
    }
  }

  /**
   * Generate chat response with character persona
   */
  async generateChatResponse(
    messages: Array<{ role: string; content: string }>,
    systemPrompt: string,
    context?: any,
  ): Promise<string> {
    if (!this.apiKey) {
      return this.getFallbackResponse();
    }

    try {
      // Convert messages to Gemini format
      const geminiMessages = messages.map((msg) => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      }));

      // Build the request
      const requestBody = {
        contents: geminiMessages,
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
      };

      // Add context if provided
      if (context) {
        requestBody['context'] = JSON.stringify(context);
      }

      const response = await fetch(
        `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        const error = await response.json();
        this.logger.error('Gemini API error:', error);
        return this.getFallbackResponse();
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      return text || this.getFallbackResponse();
    } catch (error) {
      this.logger.error('Gemini API error:', error);
      return this.getFallbackResponse();
    }
  }

  /**
   * Generate product recommendations using AI
   */
  async generateRecommendations(
    userId: string,
    favoriteFandoms: string[],
    recentProducts: any[],
    preferences: any,
  ): Promise<string[]> {
    if (!this.apiKey) {
      return ['wand', 'robe', 'potion', 'book', 'crystal'];
    }

    try {
      const prompt = `As a fandom expert, recommend 5 product categories or types that a fan would love.
User's favorite fandoms: ${favoriteFandoms.join(', ')}
Recent products viewed: ${recentProducts.map((p) => p.name).join(', ')}
User preferences: ${JSON.stringify(preferences)}

Return only a JSON array of 5 product category keywords, like: ["Wand", "Robe", "Potion", "Book", "Crystal"]`;

      const requestBody = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 200,
        },
      };

      const response = await fetch(
        `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse JSON from response
      const jsonMatch = text.match(/\[.*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return [];
    } catch (error) {
      this.logger.error('Recommendation generation error:', error);
      return [];
    }
  }

  /**
   * Analyze user behavior for personalization
   */
  async analyzeUserBehavior(
    userId: string,
    browsingHistory: any[],
    purchaseHistory: any[],
  ): Promise<any> {
    if (!this.apiKey) {
      return {};
    }

    try {
      const prompt = `Analyze this user's behavior and return insights as JSON:
Browsing: ${JSON.stringify(browsingHistory.slice(0, 10))}
Purchases: ${JSON.stringify(purchaseHistory.slice(0, 10))}

Return JSON with: {"interests": [], "preferredPriceRange": {}, "preferredFandoms": [], "shoppingStyle": ""}`;

      const requestBody = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 500,
        },
      };

      const response = await fetch(
        `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        return {};
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const jsonMatch = text.match(/\{.*\}/s);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }

      return {};
    } catch (error) {
      this.logger.error('Behavior analysis error:', error);
      return {};
    }
  }

  /**
   * Generate personalized content
   */
  async generatePersonalizedContent(
    userPreferences: any,
    contentType: 'homepage' | 'email' | 'notification',
  ): Promise<string> {
    if (!this.apiKey) {
      return '';
    }

    try {
      const prompt = `Generate personalized ${contentType} content for a fandom marketplace user.
User preferences: ${JSON.stringify(userPreferences)}
Make it exciting, engaging, and fandom-focused. Keep it concise (2-3 sentences).`;

      const requestBody = {
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 300,
        },
      };

      const response = await fetch(
        `${this.baseUrl}/models/gemini-pro:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        },
      );

      if (!response.ok) {
        return '';
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (error) {
      this.logger.error('Content generation error:', error);
      return '';
    }
  }

  private getFallbackResponse(): string {
    return "Hello! I'm here to help you discover amazing fandom products. What are you looking for today?";
  }
}
