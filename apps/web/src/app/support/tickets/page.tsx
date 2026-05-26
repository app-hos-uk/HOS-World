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
      case 'OPEN': return 'bg-yellow-500/15 text-yellow-300';
      case 'IN_PROGRESS': return 'bg-hos-gold/20 text-hos-gold';
      case 'RESOLVED': return 'bg-green-500/15 text-green-300';
      case 'CLOSED': return 'bg-hos-bg-tertiary text-hos-text-secondary';
      default: return 'bg-hos-bg-tertiary text-hos-text-secondary';
    }
  };

  const formatStatus = (status: string) => status.replace(/_/g, ' ');

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'WHOLESALER', 'B2C_SELLER', 'SELLER', 'INFLUENCER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-hos-text-secondary">My Support Tickets</h1>
              <p className="text-hos-text-secondary mt-1">View and manage your support requests</p>
            </div>
            <Link
              href="/support/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium transition-colors self-start"
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
                    ? 'bg-hos-gold text-[#1a1406]'
                    : 'bg-hos-bg-secondary text-hos-text-secondary hover:bg-hos-bg-tertiary border border-hos-border'
                }`}
              >
                {tab.label}
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-xs ${
                  statusFilter === tab.value
                    ? 'bg-hos-gold text-[#1a1406]'
                    : 'bg-hos-bg-tertiary text-hos-text-secondary'
                }`}>
                  {statusCounts[tab.value] ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Tickets List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="bg-hos-bg-secondary rounded-lg shadow p-8 text-center">
              <div className="w-16 h-16 bg-hos-bg-tertiary rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-hos-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <p className="text-hos-text-secondary mb-4">
                {tickets.length === 0
                  ? "You haven't submitted any support tickets yet"
                  : 'No tickets match the selected filter'}
              </p>
              {tickets.length === 0 && (
                <Link
                  href="/support/new"
                  className="inline-block px-6 py-3 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium"
                >
                  Submit a Ticket
                </Link>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-hos-bg-secondary border-b border-hos-border">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">Ticket ID</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">Subject</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">Status</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">Category</th>
                      <th className="text-left px-6 py-3 text-xs font-medium text-hos-text-muted uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hos-border">
                    {filteredTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-hos-bg-tertiary transition-colors">
                        <td className="px-6 py-4">
                          <Link href={`/support/tickets/${ticket.id}`} className="font-mono text-sm text-hos-gold hover:text-hos-gold-hover">
                            {ticket.id.slice(0, 8)}...
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <Link href={`/support/tickets/${ticket.id}`} className="text-hos-text-secondary hover:text-hos-gold font-medium">
                            {ticket.subject}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(ticket.status)}`}>
                            {formatStatus(ticket.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-hos-text-secondary">
                          {CATEGORY_LABELS[ticket.category] || ticket.category}
                        </td>
                        <td className="px-6 py-4 text-sm text-hos-text-muted">
                          {new Date(ticket.createdAt).toLocaleDateString('en-US', {
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
                    className="block bg-hos-bg-secondary rounded-lg shadow p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <h3 className="font-medium text-hos-text-secondary line-clamp-1">{ticket.subject}</h3>
                      <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${getStatusColor(ticket.status)}`}>
                        {formatStatus(ticket.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-hos-text-muted">
                      <span className="font-mono">{ticket.id.slice(0, 8)}...</span>
                      <span>&middot;</span>
                      <span>{CATEGORY_LABELS[ticket.category] || ticket.category}</span>
                      <span>&middot;</span>
                      <span>
                        {new Date(ticket.createdAt).toLocaleDateString('en-US', {
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
            <div className="text-sm text-hos-text-muted text-center mt-6">
              Showing {filteredTickets.length} of {tickets.length} ticket{tickets.length !== 1 ? 's' : ''}
            </div>
          )}
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
