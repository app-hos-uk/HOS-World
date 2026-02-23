'use client';

import { useEffect, useState, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  category: string;
  priority: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  orderId?: string;
}

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: 'CLOSED', label: 'Closed' },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  ORDER_INQUIRY: 'Order Inquiry',
  PRODUCT_QUESTION: 'Product Question',
  RETURN_REQUEST: 'Return Request',
  PAYMENT_ISSUE: 'Payment Issue',
  TECHNICAL_SUPPORT: 'Technical Support',
  SELLER_SUPPORT: 'Seller Support',
  OTHER: 'Other',
};

export default function SupportTicketsPage() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getMyTickets();
      if (response?.data) {
        const data = Array.isArray(response.data) ? response.data : [];
        data.sort((a: Ticket, b: Ticket) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setTickets(data);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = useMemo(() => {
    if (!statusFilter) return tickets;
    return tickets.filter((t) => t.status === statusFilter);
  }, [tickets, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { '': tickets.length };
    for (const tab of STATUS_TABS) {
      if (tab.value) {
        counts[tab.value] = tickets.filter((t) => t.status === tab.value).length;
      }
    }
    return counts;
  }, [tickets]);

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

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'WHOLESALER', 'B2C_SELLER', 'SELLER', 'INFLUENCER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Support Tickets</h1>
              <p className="text-gray-600 mt-1">View and manage your support requests</p>
            </div>
            <Link
              href="/support/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium transition-colors self-start"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Ticket
            </Link>
          </div>

          {/* Status Filter Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.label}
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                  statusFilter === tab.value
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {statusCounts[tab.value] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Tickets List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <p className="text-gray-600 mb-4">
                {tickets.length === 0
                  ? "You haven't submitted any support tickets yet"
                  : 'No tickets match the selected filter'}
              </p>
              {tickets.length === 0 && (
                <Link
                  href="/support/new"
                  className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Submit a Ticket
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Ticket ID</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <Link href={`/support/tickets/${ticket.id}`} className="font-mono text-sm text-purple-600 hover:text-purple-800">
                            {ticket.id.slice(0, 8)}...
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/support/tickets/${ticket.id}`} className="text-gray-900 hover:text-purple-600 font-medium">
                            {ticket.subject}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(ticket.status)}`}>
                            {formatStatus(ticket.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {CATEGORY_LABELS[ticket.category] || ticket.category}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(ticket.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredTickets.map((ticket) => (
                  <Link
                    key={ticket.id}
                    href={`/support/tickets/${ticket.id}`}
                    className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-medium text-gray-900 line-clamp-1">{ticket.subject}</h3>
                      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${getStatusColor(ticket.status)}`}>
                        {formatStatus(ticket.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <span className="font-mono">{ticket.id.slice(0, 8)}...</span>
                      <span>&middot;</span>
                      <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                      <span>&middot;</span>
                      <span>
                        {new Date(ticket.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}

          {!loading && tickets.length > 0 && (
            <div className="text-sm text-gray-500 text-center mt-6">
              Showing {filteredTickets.length} of {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
