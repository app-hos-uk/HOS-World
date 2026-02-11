'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'WAITING' | 'RESOLVED' | 'CLOSED';
  category?: string;
  user?: { email: string; firstName?: string; lastName?: string };
  assignedTo?: { email: string; firstName?: string; lastName?: string };
  messages?: TicketMessage[];
  createdAt: string;
  updatedAt?: string;
}

interface TicketMessage {
  id: string;
  content: string;
  sender: 'USER' | 'ADMIN';
  senderName?: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  ASSIGNED: 'bg-indigo-100 text-indigo-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  WAITING: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-yellow-100 text-yellow-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};

const TICKET_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED'];
const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export default function AdminSupportPage() {
  const toast = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const [newTicket, setNewTicket] = useState({
    subject: '',
    description: '',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    category: 'OTHER' as 'ORDER_INQUIRY' | 'PRODUCT_QUESTION' | 'RETURN_REQUEST' | 'PAYMENT_ISSUE' | 'TECHNICAL_SUPPORT' | 'SELLER_SUPPORT' | 'OTHER',
  });

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    urgent: 0,
  });

  // Use ref to skip initial mount for filter effect (avoids double-fetch)
  const isFirstRender = useRef(true);

  const fetchStats = useCallback(async () => {
    try {
      // Always fetch ALL tickets to calculate accurate stats
      const response = await apiClient.getSupportTickets({});
      let allTickets: Ticket[] = [];
      
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          allTickets = responseData;
        } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
          allTickets = responseData.data;
        }
      }
      
      // Calculate stats from ALL tickets
      setStats({
        total: allTickets.length,
        open: allTickets.filter(t => t.status === 'OPEN').length,
        inProgress: allTickets.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'WAITING'].includes(t.status)).length,
        resolved: allTickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length,
        urgent: allTickets.filter(t => t.priority === 'URGENT').length,
      });
    } catch (err: any) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Pass filterValue as parameter to avoid stale closure issues
  // Note: toast is NOT included in deps because useToast() returns a new object each render
  // The toast methods themselves are stable; including toast would cause infinite re-fetches
  const fetchTickets = useCallback(async (filterValue: string) => {
    try {
      setLoading(true);
      // For multi-status and priority filters, fetch all and filter client-side
      const isClientSideFilter = filterValue === 'inprogress' || filterValue === 'resolved' || filterValue === 'urgent';
      const statusFilter = filterValue === 'all' || isClientSideFilter ? undefined : 
        filterValue === 'open' ? 'OPEN' : 
        filterValue === 'assigned' ? 'ASSIGNED' : undefined;
      
      const response = await apiClient.getSupportTickets({ status: statusFilter });
      let ticketData: Ticket[] = [];
      
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          ticketData = responseData;
        } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
          ticketData = responseData.data;
        }
      }
      
      // Apply client-side filtering for multi-status and priority filters
      if (filterValue === 'inprogress') {
        ticketData = ticketData.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'WAITING'].includes(t.status));
      } else if (filterValue === 'resolved') {
        ticketData = ticketData.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status));
      } else if (filterValue === 'urgent') {
        ticketData = ticketData.filter(t => t.priority === 'URGENT');
      }
      
      setTickets(ticketData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch stats and tickets on mount - run sequentially to avoid race conditions
  // Uses 'all' explicitly since this is initialization (filter state starts as 'all')
  useEffect(() => {
    const initializeData = async () => {
      try {
        await fetchStats();
        await fetchTickets('all'); // Explicitly use initial value to avoid stale closure
      } catch (err) {
        // This catch handles any unexpected errors not caught by internal handlers
        // Both fetchStats and fetchTickets have their own error handling, but this
        // provides a safety net for programming errors or unexpected exceptions
        console.error('Error initializing support page:', err);
        toast.error('Failed to load support data. Please refresh the page.');
        setLoading(false);
      }
    };
    initializeData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchStats, fetchTickets]);

  // Fetch filtered tickets when filter changes (skip initial mount since handled above)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    fetchTickets(filter);
  }, [filter, fetchTickets]);

  const handleStatusUpdate = async (ticketId: string, newStatus: string) => {
    try {
      await apiClient.updateSupportTicket(ticketId, { status: newStatus });
      toast.success('Ticket status updated');
      fetchTickets(filter);
      fetchStats(); // Refresh stats after status change
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, status: newStatus as Ticket['status'] });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update ticket status');
    }
  };

  const handlePriorityUpdate = async (ticketId: string, newPriority: string) => {
    try {
      await apiClient.updateSupportTicket(ticketId, { priority: newPriority });
      toast.success('Ticket priority updated');
      fetchTickets(filter);
      fetchStats(); // Refresh stats after priority change (affects urgent count)
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket({ ...selectedTicket, priority: newPriority as Ticket['priority'] });
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update ticket priority');
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyContent.trim()) return;
    
    try {
      setSendingReply(true);
      await apiClient.replyToSupportTicket(selectedTicket.id, {
        content: replyContent,
        sender: 'ADMIN',
      });
      toast.success('Reply sent successfully');
      setReplyContent('');
      
      // Refresh ticket to get updated messages
      const response = await apiClient.getSupportTicket(selectedTicket.id);
      if (response?.data) {
        setSelectedTicket(response.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to send reply');
    } finally {
      setSendingReply(false);
    }
  };

  const handleCreateTicket = async () => {
    if (creatingTicket) return;
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast.error('Subject and description are required');
      return;
    }
    try {
      setCreatingTicket(true);
      await apiClient.createSupportTicket({
        subject: newTicket.subject.trim(),
        category: newTicket.category,
        priority: newTicket.priority,
        initialMessage: newTicket.description.trim(),
      });
      toast.success('Ticket created successfully');
      setShowCreateModal(false);
      setNewTicket({ subject: '', description: '', priority: 'MEDIUM', category: 'OTHER' });
      fetchTickets(filter);
      fetchStats(); // Refresh stats after creating new ticket
    } catch (err: any) {
      toast.error(err.message || 'Failed to create ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

  const openTicketDetails = async (ticket: Ticket) => {
    try {
      // Fetch full ticket with messages
      const response = await apiClient.getSupportTicket(ticket.id);
      if (response?.data) {
        setSelectedTicket(response.data);
      } else {
        setSelectedTicket(ticket);
      }
      setShowDetailsModal(true);
    } catch {
      setSelectedTicket(ticket);
      setShowDetailsModal(true);
    }
  };

  // Filter tickets
  const filteredTickets = tickets.filter((ticket) => {
    const searchLower = searchTerm.toLowerCase();
    return !searchTerm ||
      ticket.ticketNumber?.toLowerCase().includes(searchLower) ||
      ticket.subject?.toLowerCase().includes(searchLower) ||
      ticket.user?.email?.toLowerCase().includes(searchLower);
  });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Support Center</h1>
              <p className="text-gray-600 mt-1">Manage customer support tickets</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              + New Ticket
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <button
              onClick={() => setFilter('all')}
              className={`bg-white rounded-lg shadow p-4 text-left ${filter === 'all' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Total Tickets</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </button>
            <button
              onClick={() => setFilter('open')}
              className={`bg-white rounded-lg shadow p-4 text-left ${filter === 'open' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Open</h3>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.open}</p>
            </button>
            <button
              onClick={() => setFilter('inprogress')}
              className={`bg-white rounded-lg shadow p-4 text-left ${filter === 'inprogress' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">In Progress</h3>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.inProgress}</p>
            </button>
            <button
              onClick={() => setFilter('resolved')}
              className={`bg-white rounded-lg shadow p-4 text-left ${filter === 'resolved' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Resolved</h3>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.resolved}</p>
            </button>
            <button
              onClick={() => setFilter('urgent')}
              className={`bg-white rounded-lg shadow p-4 text-left ${filter === 'urgent' ? 'ring-2 ring-purple-500' : ''}`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Urgent</h3>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.urgent}</p>
            </button>
          </div>

          {/* Search */}
          <div className="bg-white rounded-lg shadow p-4">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ticket number, subject, or customer email..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTickets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        <span className="text-4xl block mb-2">🎫</span>
                        <p>No tickets found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900">#{ticket.ticketNumber}</div>
                          <div className="text-sm text-gray-500 truncate max-w-xs">{ticket.subject}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {ticket.user?.email || 'Unknown'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={ticket.priority}
                            onChange={(e) => handlePriorityUpdate(ticket.id, e.target.value)}
                            className={`text-xs font-semibold rounded-full px-2 py-1 border-0 cursor-pointer ${
                              PRIORITY_COLORS[ticket.priority] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {TICKET_PRIORITIES.map((p) => (
                              <option key={p} value={p}>{p}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={ticket.status}
                            onChange={(e) => handleStatusUpdate(ticket.id, e.target.value)}
                            className={`text-xs font-semibold rounded-full px-2 py-1 border-0 cursor-pointer ${
                              STATUS_COLORS[ticket.status] || 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {TICKET_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openTicketDetails(ticket)}
                            className="text-purple-600 hover:text-purple-900"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Ticket Details Modal */}
          {showDetailsModal && selectedTicket && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <div className="bg-white rounded-lg max-w-4xl w-full my-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <h2 className="text-2xl font-bold text-gray-900">
                          #{selectedTicket.ticketNumber}
                        </h2>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          PRIORITY_COLORS[selectedTicket.priority]
                        }`}>
                          {selectedTicket.priority}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          STATUS_COLORS[selectedTicket.status]
                        }`}>
                          {selectedTicket.status}
                        </span>
                      </div>
                      <p className="text-lg text-gray-600 mt-1">{selectedTicket.subject}</p>
                    </div>
                    <button
                      onClick={() => setShowDetailsModal(false)}
                      className="text-gray-400 hover:text-gray-600 text-2xl"
                    >
                      ×
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Customer</h3>
                      <p className="text-gray-900">
                        {selectedTicket.user?.firstName || ''} {selectedTicket.user?.lastName || ''}
                      </p>
                      <p className="text-sm text-gray-500">{selectedTicket.user?.email || 'Unknown'}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-medium text-gray-500 mb-1">Created</h3>
                      <p className="text-gray-900">{formatDate(selectedTicket.createdAt)}</p>
                    </div>
                    {selectedTicket.assignedTo && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h3 className="text-sm font-medium text-gray-500 mb-1">Assigned To</h3>
                        <p className="text-gray-900">
                          {selectedTicket.assignedTo.firstName || ''} {selectedTicket.assignedTo.lastName || ''}
                        </p>
                        <p className="text-sm text-gray-500">{selectedTicket.assignedTo.email}</p>
                      </div>
                    )}
                  </div>

                  {/* Update Status/Priority */}
                  <div className="flex gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select
                        value={selectedTicket.status}
                        onChange={(e) => handleStatusUpdate(selectedTicket.id, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        {TICKET_STATUSES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={selectedTicket.priority}
                        onChange={(e) => handlePriorityUpdate(selectedTicket.id, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg"
                      >
                        {TICKET_PRIORITIES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Original Description */}
                  {selectedTicket.description && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-gray-700 mb-2">Original Message</h3>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-gray-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Conversation Thread */}
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Conversation</h3>
                    <div className="border rounded-lg max-h-80 overflow-y-auto">
                      {selectedTicket.messages && selectedTicket.messages.length > 0 ? (
                        <div className="divide-y divide-gray-200">
                          {selectedTicket.messages.map((message) => (
                            <div
                              key={message.id}
                              className={`p-4 ${message.sender === 'ADMIN' ? 'bg-purple-50' : 'bg-white'}`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                                    message.sender === 'ADMIN' 
                                      ? 'bg-purple-200 text-purple-800' 
                                      : 'bg-gray-200 text-gray-800'
                                  }`}>
                                    {message.sender}
                                  </span>
                                  {message.senderName && (
                                    <span className="text-sm text-gray-600">{message.senderName}</span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">{formatDate(message.createdAt)}</span>
                              </div>
                              <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 text-center text-gray-500">
                          No messages yet
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reply Form */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Send Reply</h3>
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Type your response here..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      rows={4}
                    />
                    <div className="flex justify-end gap-3 mt-3">
                      <button
                        onClick={() => setShowDetailsModal(false)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      >
                        Close
                      </button>
                      <button
                        onClick={handleSendReply}
                        disabled={sendingReply || !replyContent.trim()}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                      >
                        {sendingReply ? 'Sending...' : 'Send Reply'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create Ticket Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg max-w-lg w-full p-6">
                <div className="flex justify-between items-start mb-4">
                  <h2 className="text-xl font-bold">Create New Ticket</h2>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="text-gray-400 hover:text-gray-600 text-2xl"
                  >
                    ×
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                    <input
                      type="text"
                      value={newTicket.subject}
                      onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      placeholder="Brief description of the issue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newTicket.description}
                      onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      rows={4}
                      placeholder="Detailed description..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                      <select
                        value={newTicket.priority}
                        onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        {TICKET_PRIORITIES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                      <select
                        value={newTicket.category}
                        onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value as typeof newTicket.category })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="OTHER">General / Other</option>
                        <option value="ORDER_INQUIRY">Order Inquiry</option>
                        <option value="PRODUCT_QUESTION">Product Question</option>
                        <option value="PAYMENT_ISSUE">Payment Issue</option>
                        <option value="RETURN_REQUEST">Return / Refund Request</option>
                        <option value="TECHNICAL_SUPPORT">Technical Support</option>
                        <option value="SELLER_SUPPORT">Seller Support</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCreateTicket}
                      disabled={creatingTicket || !newTicket.subject.trim() || !newTicket.description.trim()}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {creatingTicket ? 'Creating...' : 'Create Ticket'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
