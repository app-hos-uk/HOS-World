'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  knowledgeBaseArticles?: Array<{
    id: string;
    title: string;
    slug: string;
    category: string;
  }>;
  suggestedActions?: string[];
}

interface AISupportChatProps {
  userId?: string;
  sellerId?: string;
  onEscalate?: () => void;
  context?: {
    orderId?: string;
    productId?: string;
    ticketId?: string;
  };
}

export function AISupportChat({ userId, sellerId, onEscalate, context }: AISupportChatProps) {
  const { user, isAuthenticated } = useAuth();
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showEscalate, setShowEscalate] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isAuthenticated && user && !conversationId) {
      createConversation();
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const createConversation = async () => {
    try {
      const response = await apiClient.createChatConversation({
        userId: userId || user?.id,
        sellerId,
      });
      if (response?.data?.conversationId) {
        setConversationId(response.data.conversationId);
      }
    } catch (err: any) {
      console.error('Failed to create conversation:', err);
      // Continue without conversation ID
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setLoading(true);

    // Add user message
    const newUserMessage: Message = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newUserMessage]);

    try {
      const response = await apiClient.sendChatbotMessage({
        userId: userId || user?.id,
        sellerId,
        message: userMessage,
        conversationId: conversationId || undefined,
        context,
      });

      if (response?.data) {
        const aiMessage: Message = {
          role: 'assistant',
          content: response.data.response || 'I apologize, but I couldn\'t generate a response. Please try again or contact support.',
          timestamp: new Date(),
          knowledgeBaseArticles: response.data.knowledgeBaseArticles,
          suggestedActions: response.data.suggestedActions,
        };

        setMessages((prev) => [...prev, aiMessage]);

        // Update conversation ID if provided
        if (response.data.conversationId && !conversationId) {
          setConversationId(response.data.conversationId);
        }

        // Show escalate option if needed
        if (response.data.needsEscalation) {
          setShowEscalate(true);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or contact support.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async () => {
    if (!onEscalate) {
      // Default escalation: create a support ticket
      try {
        const lastUserMessage = messages.filter(m => m.role === 'user').pop();
        await apiClient.escalateToHuman({
          userId: userId || user?.id,
          sellerId,
          message: lastUserMessage?.content || 'Need human assistance',
          conversationId: conversationId || undefined,
          reason: 'User requested human support',
        });
        toast.success('Your conversation has been escalated. A support ticket has been created.');
      } catch (err: any) {
        toast.error(err.message || 'Failed to escalate');
      }
    } else {
      onEscalate();
    }
  };

  const getActionLink = (action: string): string => {
    switch (action) {
      case 'view_orders':
        return sellerId ? '/seller/orders' : '/profile?tab=orders';
      case 'create_return':
        return '/returns';
      case 'view_payments':
        return '/profile?tab=payments';
      case 'browse_products':
        return '/products';
      case 'view_profile':
        return '/profile';
      case 'create_ticket':
        return sellerId ? '/seller/support' : '/support';
      default:
        return '#';
    }
  };

  const getActionLabel = (action: string): string => {
    switch (action) {
      case 'view_orders':
        return 'View Orders';
      case 'create_return':
        return 'Create Return';
      case 'view_payments':
        return 'View Payments';
      case 'browse_products':
        return 'Browse Products';
      case 'view_profile':
        return 'View Profile';
      case 'create_ticket':
        return 'Create Support Ticket';
      default:
        return action;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-lg border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-lg">AI Support Assistant</h3>
            <p className="text-sm text-purple-100">Powered by Gemini AI</p>
          </div>
          {showEscalate && (
            <button
              onClick={handleEscalate}
              className="px-3 py-1.5 bg-white text-purple-600 rounded-lg text-sm font-medium hover:bg-purple-50 transition-colors"
            >
              Talk to Human
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[400px] max-h-[500px]">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">🤖</div>
            <p className="text-sm">Hello! I'm your AI support assistant.</p>
            <p className="text-xs mt-1">Ask me anything about orders, products, returns, or account issues.</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              
              {message.knowledgeBaseArticles && message.knowledgeBaseArticles.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300">
                  <p className="text-xs font-medium mb-1">📚 Related Articles:</p>
                  <ul className="text-xs space-y-1">
                    {message.knowledgeBaseArticles.map((article) => (
                      <li key={article.id}>
                        <Link
                          href={`/help/article/${article.slug}`}
                          className="text-blue-600 hover:underline"
                          target="_blank"
                        >
                          {article.title}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {message.suggestedActions && message.suggestedActions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-300">
                  <p className="text-xs font-medium mb-1">💡 Quick Actions:</p>
                  <div className="flex flex-wrap gap-1">
                    {message.suggestedActions.map((action) => (
                      <Link
                        key={action}
                        href={getActionLink(action)}
                        className="text-xs px-2 py-1 bg-white bg-opacity-20 rounded hover:bg-opacity-30 transition-colors"
                      >
                        {getActionLabel(action)}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-xs opacity-70 mt-1">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={loading || !isAuthenticated}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || !isAuthenticated}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
        {!isAuthenticated && (
          <p className="text-xs text-gray-500 mt-2">
            Please <Link href="/login" className="text-purple-600 hover:underline">login</Link> to use AI support
          </p>
        )}
      </div>
    </div>
  );
}

