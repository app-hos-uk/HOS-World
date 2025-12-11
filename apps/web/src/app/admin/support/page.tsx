'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';

export default function AdminSupportPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'assigned' | 'in_progress' | 'resolved'>('all');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTo, setAssignTo] = useState('');

  useEffect(() => {
    fetchTickets();
    fetchAgents();
  }, [filter]);

  const fetchTickets = async () => {
    try {
      setLoading(true);
      let statusFilter: string | undefined;
      if (filter === 'open') statusFilter = 'OPEN';
      else if (filter === 'assigned') statusFilter = 'ASSIGNED';
      else if (filter === 'in_progress') statusFilter = 'IN_PROGRESS';
      else if (filter === 'resolved') statusFilter = 'RESOLVED';

      const response = await apiClient.getSupportTickets({ 
        status: statusFilter,
        limit: 100 
      });
      
      let ticketData: any[] = [];
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (responseData?.tickets && Array.isArray(responseData.tickets)) {
          ticketData = responseData.tickets;
        } else if (Array.isArray(responseData)) {
          ticketData = responseData;
        } else if (responseData?.data && Array.isArray(responseData.data)) {
          ticketData = responseData.data;
        }
      }
      setTickets(ticketData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const response = await apiClient.getUsers();
      if (response?.data) {
        // Filter for admin users who can be assigned tickets
        const adminUsers = response.data.filter((u: any) => 
          ['ADMIN', 'PROCUREMENT', 'FULFILLMENT'].includes(u.role)
        );
        setAgents(adminUsers);
      }
    } catch (err: any) {
      console.error('Failed to fetch agents:', err);
    }
  };

  const handleViewTicket = async (ticketId: string) => {
    try {
      const response = await apiClient.getSupportTicketById(ticketId);
      if (response?.data) {
        setSelectedTicket(response.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load ticket');
    }
  };

  const handleAssignTicket = async () => {
    if (!selectedTicket || !assignTo) return;

    try {
      await apiClient.assignTicket(selectedTicket.id, assignTo);
      toast.success('Ticket assigned successfully!');
      setShowAssignModal(false);
      setAssignTo('');
      await handleViewTicket(selectedTicket.id);
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign ticket');
    }
  };

  const handleUpdateStatus = async (status: string) => {
    if (!selectedTicket) return;

    try {
      await apiClient.updateTicketStatus(selectedTicket.id, status as any);
      toast.success('Ticket status updated!');
      await handleViewTicket(selectedTicket.id);
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      setSendingMessage(true);
      await apiClient.addTicketMessage(selectedTicket.id, {
        content: newMessage,
        isInternal: false,
      });
      toast.success('Message sent successfully!');
      setNewMessage('');
      await handleViewTicket(selectedTicket.id);
      fetchTickets();
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendInternalNote = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      setSendingMessage(true);
      await apiClient.addTicketMessage(selectedTicket.id, {
        content: newMessage,
        isInternal: true,
      });
      toast.success('Internal note added!');
      setNewMessage('');
      await handleViewTicket(selectedTicket.id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to add note');
    } finally {
      setSendingMessage(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-green-100 text-green-800';
      case 'OPEN':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
      case 'ASSIGNED':
        return 'bg-purple-100 text-purple-800';
      case 'WAITING_CUSTOMER':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT':
        return 'bg-red-100 text-red-800';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
            <div className="text-sm text-gray-500">
              Total: {tickets.length} tickets
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {(['all', 'open', 'assigned', 'in_progress', 'resolved'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1).replace('_', ' ')}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : selectedTicket ? (
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{selectedTicket.subject}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Ticket #{selectedTicket.ticketNumber} • Created {new Date(selectedTicket.createdAt).toLocaleString()}
                  </p>
                  {selectedTicket.user && (
                    <p className="text-sm text-gray-600 mt-1">
                      Customer: {selectedTicket.user.firstName} {selectedTicket.user.lastName} ({selectedTicket.user.email})
                    </p>
                  )}
                  {selectedTicket.seller && (
                    <p className="text-sm text-gray-600 mt-1">
                      Seller: {selectedTicket.seller.storeName}
                    </p>
                  )}
                  {selectedTicket.order && (
                    <p className="text-sm text-gray-600 mt-1">
                      Order: #{selectedTicket.order.orderNumber}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ← Back to List
                </button>
              </div>

              <div className="flex gap-2 mb-4 flex-wrap">
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedTicket.status)}`}>
                  {selectedTicket.status}
                </span>
                <span className={`px-3 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedTicket.priority)}`}>
                  {selectedTicket.priority}
                </span>
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                  {selectedTicket.category.replace('_', ' ')}
                </span>
                {selectedTicket.assignedAgent && (
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    Assigned to: {selectedTicket.assignedAgent.firstName} {selectedTicket.assignedAgent.lastName}
                  </span>
                )}
                {selectedTicket.slaDueAt && (
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                    SLA: {new Date(selectedTicket.slaDueAt).toLocaleString()}
                  </span>
                )}
              </div>

              <div className="flex gap-2 mb-4 flex-wrap">
                {!selectedTicket.assignedAgent && (
                  <button
                    onClick={() => setShowAssignModal(true)}
                    className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                  >
                    Assign Ticket
                  </button>
                )}
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleUpdateStatus(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
                >
                  <option value="OPEN">Open</option>
                  <option value="ASSIGNED">Assigned</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="WAITING_CUSTOMER">Waiting Customer</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="CLOSED">Closed</option>
                </select>
              </div>

              <div className="space-y-4 mb-6 border-t pt-4">
                {selectedTicket.messages?.map((message: any) => (
                  <div
                    key={message.id}
                    className={`p-4 rounded-lg ${
                      message.isInternal 
                        ? 'bg-yellow-50 border border-yellow-200' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">
                          {message.user 
                            ? `${message.user.firstName} ${message.user.lastName}` 
                            : 'Support Team'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(message.createdAt).toLocaleString()}
                        </p>
                      </div>
                      {message.isInternal && (
                        <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded">
                          Internal Note
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <div className="mb-3">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Type your message..."
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingMessage ? 'Sending...' : 'Send Reply'}
                  </button>
                  <button
                    onClick={handleSendInternalNote}
                    disabled={!newMessage.trim() || sendingMessage}
                    className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Internal Note
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ticket #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subject</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tickets.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-6 py-4 text-center text-gray-500">No tickets found</td>
                    </tr>
                  ) : (
                    tickets.map((ticket) => (
                      <tr key={ticket.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{ticket.ticketNumber}</td>
                        <td className="px-6 py-4 text-sm">{ticket.subject}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {ticket.category?.replace('_', ' ')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(ticket.status)}`}>
                            {ticket.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {ticket.assignedAgent 
                            ? `${ticket.assignedAgent.firstName} ${ticket.assignedAgent.lastName}`
                            : 'Unassigned'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => handleViewTicket(ticket.id)}
                            className="text-purple-600 hover:text-purple-700 font-medium"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {showAssignModal && selectedTicket && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">Assign Ticket</h3>
                <select
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 mb-4"
                >
                  <option value="">Select an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.firstName} {agent.lastName} ({agent.email}) - {agent.role}
                    </option>
                  ))}
                </select>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowAssignModal(false);
                      setAssignTo('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssignTicket}
                    disabled={!assignTo}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    Assign
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}
