'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

interface Message {
  id: string;
  content?: string;
  message?: string;
  sender?: string;
  senderName?: string;
  senderRole?: string;
  userId?: string;
  createdAt: string | Date;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  category: string;
  priority: string;
  orderId?: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  messages?: Message[];
}

const CATEGORY_LABELS: Record<string, string> = {
  ORDER_INQUIRY: 'Order Inquiry',
  PRODUCT_QUESTION: 'Product Question',
  RETURN_REQUEST: 'Return Request',
  PAYMENT_ISSUE: 'Payment Issue',
  TECHNICAL_SUPPORT: 'Technical Support',
  SELLER_SUPPORT: 'Seller Support',
  OTHER: 'Other',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

export default function TicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;
  const toast = useToast();
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ticketId) fetchTicket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const fetchTicket = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getTicketById(ticketId);
      if (response?.data) {
        setTicket(response.data);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) {
      toast.error('Please enter a message');
      return;
    }
    try {
      setSubmitting(true);
      await apiClient.addTicketMessage(ticketId, replyText.trim());
      toast.success('Reply sent');
      setReplyText('');
      await fetchTicket();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send reply');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return 'bg-yellow-100 text-yellow-800';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800';
      case 'RESOLVED': return 'bg-green-100 text-green-800';
      case 'CLOSED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatStatus = (status: string) => status.replace(/_/g, ' ');

  const getMessageContent = (msg: Message) => msg.content || msg.message || '';

  const isOwnMessage = (msg: Message) => {
    if (msg.userId && user?.id) return msg.userId === user.id;
    if (msg.senderRole === 'CUSTOMER' || msg.senderRole === 'USER') return true;
    return false;
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'WHOLESALER', 'B2C_SELLER', 'SELLER', 'INFLUENCER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <Link href="/support/tickets" className="text-purple-600 hover:text-purple-800 mb-4 inline-flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Tickets
          </Link>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : !ticket ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600 mb-4">Ticket not found</p>
              <Link href="/support/tickets" className="text-purple-600 hover:text-purple-800 font-medium">
                Return to tickets
              </Link>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {/* Ticket Header */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{ticket.subject}</h1>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full whitespace-nowrap ${getStatusColor(ticket.status)}`}>
                    {formatStatus(ticket.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500 block">Ticket ID</span>
                    <span className="font-mono font-medium text-gray-900">{ticket.id.slice(0, 8)}...</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Category</span>
                    <span className="font-medium text-gray-900">{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Priority</span>
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${PRIORITY_COLORS[ticket.priority] || 'bg-gray-100 text-gray-700'}`}>
                      {ticket.priority}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500 block">Created</span>
                    <span className="font-medium text-gray-900">
                      {new Date(ticket.createdAt).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>

                {ticket.orderId && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <span className="text-sm text-gray-500">Linked Order: </span>
                    <Link href={`/orders/${ticket.orderId}`} className="text-sm text-purple-600 hover:text-purple-800 font-medium">
                      {ticket.orderId.slice(0, 8)}...
                    </Link>
                  </div>
                )}
              </div>

              {/* Messages Thread */}
              <div className="bg-white rounded-lg shadow">
                <div className="p-4 sm:p-6 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Conversation</h2>
                </div>

                <div className="divide-y divide-gray-100">
                  {ticket.messages && ticket.messages.length > 0 ? (
                    ticket.messages.map((msg, index) => {
                      const own = isOwnMessage(msg);
                      return (
                        <div key={msg.id || index} className={`p-4 sm:p-6 ${own ? 'bg-white' : 'bg-purple-50'}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                own ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-700'
                              }`}>
                                {own ? 'Y' : 'S'}
                              </div>
                              <div>
                                <span className="font-medium text-gray-900 text-sm">
                                  {msg.senderName || (own ? 'You' : 'Support')}
                                </span>
                                {msg.senderRole && !own && (
                                  <span className="ml-2 text-xs text-gray-500">({msg.senderRole})</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(msg.createdAt).toLocaleString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <div className="pl-10 text-sm text-gray-700 whitespace-pre-wrap">
                            {getMessageContent(msg)}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-gray-500 text-sm">
                      No messages yet.
                    </div>
                  )}
                </div>

                {/* Reply Form */}
                {ticket.status !== 'CLOSED' && (
                  <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
                    <form onSubmit={handleReply} className="space-y-3">
                      <label htmlFor="reply" className="block text-sm font-medium text-gray-700">
                        Reply
                      </label>
                      <textarea
                        id="reply"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none"
                        placeholder="Type your reply..."
                        maxLength={5000}
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-400">{replyText.length}/5000</span>
                        <button
                          type="submit"
                          disabled={submitting || !replyText.trim()}
                          className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                        >
                          {submitting ? 'Sending...' : 'Send Reply'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {ticket.status === 'CLOSED' && (
                  <div className="p-4 sm:p-6 border-t border-gray-200 bg-gray-50 text-center">
                    <p className="text-sm text-gray-500">This ticket is closed. If you need further help, please <Link href="/support/new" className="text-purple-600 hover:text-purple-800 font-medium">open a new ticket</Link>.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
