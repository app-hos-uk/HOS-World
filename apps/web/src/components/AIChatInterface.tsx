'use client';

import { useState, useEffect, useRef } from 'react';
import { apiClient } from '@/lib/api';
import Image from 'next/image';
import { getPublicApiBaseUrl } from '@/lib/apiBaseUrl';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface Character {
  id: string;
  name: string;
  avatar?: string;
  fandom: {
    name: string;
  };
}

interface AIChatInterfaceProps {
  characterId: string;
  character?: Character;
  onClose?: () => void;
}

export function AIChatInterface({ characterId, character, onClose }: AIChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [characterInfo, setCharacterInfo] = useState<Character | null>(character || null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;

    const loadCharacterWithAbort = async () => {
      try {
        const apiUrl = getPublicApiBaseUrl() || 'http://localhost:3001/api';
        const response = await fetch(`${apiUrl}/characters/${characterId}`, { signal });
        if (!response.ok) throw new Error(`Failed to load character: ${response.status}`);
        const data = await response.json();
        setCharacterInfo(data.data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error('Error loading character:', err);
      }
    };

    const loadChatHistoryWithAbort = async () => {
      try {
        const apiUrl = getPublicApiBaseUrl() || 'http://localhost:3001/api';
        const response = await fetch(`${apiUrl}/ai/chat/history?characterId=${characterId}`, {
          credentials: 'include',
          signal,
        });
        if (!response.ok) throw new Error(`Failed to load chat history: ${response.status}`);
        const data = await response.json();
        if (data.data?.length > 0) {
          setMessages(data.data[0].messages || []);
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') console.error('Error loading chat history:', err);
      }
    };

    if (characterId && !character) loadCharacterWithAbort();
    loadChatHistoryWithAbort();

    return () => controller.abort();
  }, [characterId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const apiUrl = getPublicApiBaseUrl() || 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/ai/chat/${characterId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ message: userMessage.content }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send message: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.data) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.data.response,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Show product recommendations if available
        if (data.data.productRecommendations && data.data.productRecommendations.length > 0) {
          // Product recommendations available — can be rendered in a dedicated component
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: "I'm having trouble right now. Please try again later!",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-hos-bg-secondary rounded-xl shadow-lg border border-hos-border">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-hos-border">
        <div className="flex items-center gap-3">
          {characterInfo?.avatar ? (
            <Image
              src={characterInfo.avatar}
              alt={characterInfo.name}
              width={40}
              height={40}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-hos-gold/20 flex items-center justify-center">
              <span className="text-xl">🧙</span>
            </div>
          )}
          <div>
            <h3 className="font-semibold">{characterInfo?.name || 'Character'}</h3>
            <p className="text-xs text-hos-text-muted">{characterInfo?.fandom.name}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-hos-text-muted hover:text-hos-text-secondary"
          >
            ✕
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-hos-text-muted mt-8">
            <p className="text-lg font-semibold mb-2">Start chatting!</p>
            <p className="text-sm">Ask {characterInfo?.name} about products, fandoms, or recommendations.</p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === 'user'
                  ? 'bg-hos-gold text-[#1a1406]'
                  : 'bg-hos-bg-tertiary text-hos-text-secondary'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-hos-bg-tertiary rounded-lg p-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-hos-text-muted rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-hos-text-muted rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-hos-text-muted rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="p-4 border-t border-hos-border">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-transparent"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg font-semibold hover:bg-hos-gold-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

