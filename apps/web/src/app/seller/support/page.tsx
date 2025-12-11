'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { AISupportChat } from '@/components/AISupportChat';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/useToast';

export default function SellerSupportPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [sellerId, setSellerId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    subject: '',
    category: 'SELLER_SUPPORT' as 'ORDER_INQUIRY' | 'PRODUCT_QUESTION' | 'RETURN_REQUEST' | 'PAYMENT_ISSUE' | 'TECHNICAL_SUPPORT' | 'SELLER_SUPPORT' | 'OTHER',
    priority: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    initialMessage: '',
    orderId: '',
  });

  const menuItems = [
    { title: 'Dashboard', href: '/seller/dashboard', icon: '📊' },
    { title: 'Submit Product', href: '/seller/submit-product', icon: '➕' },
    { title: 'My Products', href: '/seller/products', icon: '📦' },
    { title: 'Orders', href: '/seller/orders', icon: '🛒' },
    { title: 'Submissions', href: '/seller/submissions', icon: '📝' },
    { title: 'Support', href: '/seller/support', icon: '🎧' },
  ];

  useEffect(() => {
    fetchSellerProfile();
  }, []);

  useEffect(() => {
    if (sellerId) {
      fetchTickets();
    }
  }, [sellerId]);

  const fetchSellerProfile = async () => {
    try {
      const response = await apiClient.getSellerProfile();
      if (response?.data?.id) {
        setSellerId(response.data.id);
      }
    } catch (err: any) {
      console.error('Failed to fetch seller profile:', err);
    }
  };

  const fetchTickets = async () => {
    if (!sellerId) return;
    try {
      setLoading(true);
      const response = await apiClient.getSupportTickets({ sellerId });
      if (response?.data) {
        const ticketData = response.data.tickets || response.data || [];
        setTickets(Array.isArray(ticketData) ? ticketData : []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load tickets');
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerId) {
      toast.error('Seller profile not found');
      return;
    }

    try {
      const response = await apiClient.createSupportTicket({
        sellerId,
        subject: formData.subject,
        category: formData.category,
        priority: formData.priority,
        initialMessage: formData.initialMessage,
        orderId: formData.orderId || undefined,
      });

      if (response?.data) {
        toast.success('Ticket created successfully!');
        setShowCreateForm(false);
        setFormData({
          subject: '',
          category: 'SELLER_SUPPORT',
          priority: 'MEDIUM',
          initialMessage: '',
          orderId: '',
        });
        fetchTickets();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to create ticket');
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

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedTicket) return;

    try {
      setSendingMessage(true);
      await apiClient.addTicketMessage(selectedTicket.id, {
        content: newMessage,
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-green-100 text-green-800';
      case 'OPEN':
        return 'bg-blue-100 text-blue-800';
      case 'IN_PROGRESS':
        return 'bg-yellow-100 text-yellow-800';
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
    <RouteGuard allowedRoles={['B2C_SELLER', 'SELLER', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Seller Support">
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Seller Support</h1>
              <p className="text-gray-600 mt-2">Get help with your seller account, products, and orders</p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              {showCreateForm ? 'Cancel' : '+ New Ticket'}
            </button>
          </div>
        </div>

        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Create Support Ticket</h3>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject *
                </label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Brief description of your issue"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="SELLER_SUPPORT">Seller Support</option>
                    <option value="ORDER_INQUIRY">Order Inquiry</option>
                    <option value="PRODUCT_QUESTION">Product Question</option>
                    <option value="PAYMENT_ISSUE">Payment Issue</option>
                    <option value="TECHNICAL_SUPPORT">Technical Support</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order ID (if related to an order)
                </label>
                <input
                  type="text"
                  value={formData.orderId}
                  onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Optional: Enter order number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Message *
                </label>
                <textarea
                  required
                  value={formData.initialMessage}
                  onChange={(e) => setFormData({ ...formData, initialMessage: e.target.value })}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Describe your issue in detail..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : selectedTicket ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-semibold">{selectedTicket.subject}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Ticket #{selectedTicket.ticketNumber} • Created {new Date(selectedTicket.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ← Back to Tickets
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(selectedTicket.status)}`}>
                {selectedTicket.status}
              </span>
              <span className={`px-3 py-1 text-xs font-medium rounded-full ${getPriorityColor(selectedTicket.priority)}`}>
                {selectedTicket.priority}
              </span>
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                {selectedTicket.category.replace('_', ' ')}
              </span>
            </div>

            <div className="space-y-4 mb-6">
              {selectedTicket.messages?.map((message: any) => (
                <div
                  key={message.id}
                  className={`p-4 rounded-lg ${
                    message.isInternal ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium">
                        {message.user ? `${message.user.firstName} ${message.user.lastName}` : 'Support Team'}
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

            {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
              <div className="border-t pt-4">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-3"
                  placeholder="Type your message..."
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sendingMessage}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingMessage ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {tickets.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-500 mb-4">No support tickets yet</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Create Your First Ticket
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleViewTicket(ticket.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{ticket.subject}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          #{ticket.ticketNumber} • {ticket.category.replace('_', ' ')}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(ticket.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">AI Support Assistant</h2>
            <div className="h-[500px]">
              <AISupportChat
                sellerId={sellerId || undefined}
                userId={user?.id}
                onEscalate={() => {
                  setShowCreateForm(true);
                  toast.success('You can create a support ticket below');
                }}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold mb-4">Need More Help?</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium mb-2">📧 Email Support</h3>
                <p className="text-sm text-gray-600">seller-support@houseofspells.com</p>
              </div>
              <div>
                <h3 className="font-medium mb-2">📞 Phone Support</h3>
                <p className="text-sm text-gray-600">1-800-HOS-SELLER</p>
              </div>
              <div>
                <h3 className="font-medium mb-2">💬 WhatsApp</h3>
                <p className="text-sm text-gray-600">Available 24/7</p>
              </div>
              <div>
                <h3 className="font-medium mb-2">📚 Seller Resources</h3>
                <a href="/help" className="text-sm text-purple-600 hover:text-purple-700">
                  Visit Help Center →
                </a>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </RouteGuard>
  );
}

