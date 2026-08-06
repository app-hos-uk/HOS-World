'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

type Tab = 'conversations' | 'templates' | 'send';

export default function AdminWhatsAppPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('conversations');

  // Conversations state
  const [conversations, setConversations] = useState<any[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [expandedConversation, setExpandedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Templates state
  const [templates, setTemplates] = useState<any[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ name: '', category: 'MARKETING', content: '', variables: '' });
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // Send message state
  const [sendForm, setSendForm] = useState({ to: '', message: '', mediaUrl: '' });
  const [sending, setSending] = useState(false);

  // Send template state
  const [templateSendForm, setTemplateSendForm] = useState({ to: '', templateName: '', variables: '' });
  const [sendingTemplate, setSendingTemplate] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (activeTab === 'templates') {
      fetchTemplates();
    }
  }, [activeTab]);

  const fetchConversations = async () => {
    try {
      setLoadingConversations(true);
      const response = await apiClient.getWhatsAppConversations();
      let conversationData: any[] = [];
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          conversationData = responseData;
        } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
          conversationData = responseData.data;
        }
      }
      setConversations(conversationData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load conversations');
      setConversations([]);
    } finally {
      setLoadingConversations(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      setLoadingMessages(true);
      const response = await apiClient.getWhatsAppMessages(conversationId);
      let msgData: any[] = [];
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          msgData = responseData;
        } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
          msgData = responseData.data;
        }
      }
      setMessages(msgData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load messages');
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleConversationClick = (conversationId: string) => {
    if (expandedConversation === conversationId) {
      setExpandedConversation(null);
      setMessages([]);
    } else {
      setExpandedConversation(conversationId);
      fetchMessages(conversationId);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const response = await apiClient.getWhatsAppTemplates();
      let templateData: any[] = [];
      if (response && 'data' in response) {
        const responseData = response.data as any;
        if (Array.isArray(responseData)) {
          templateData = responseData;
        } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
          templateData = responseData.data;
        }
      }
      setTemplates(templateData);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load templates');
      setTemplates([]);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.content) {
      toast.error('Name and content are required');
      return;
    }
    try {
      setCreatingTemplate(true);
      const variables = newTemplate.variables
        ? newTemplate.variables.split(',').map((v) => v.trim()).filter(Boolean)
        : undefined;
      await apiClient.createWhatsAppTemplate({
        name: newTemplate.name,
        category: newTemplate.category,
        content: newTemplate.content,
        variables,
      });
      toast.success('Template created successfully');
      setNewTemplate({ name: '', category: 'MARKETING', content: '', variables: '' });
      fetchTemplates();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create template');
    } finally {
      setCreatingTemplate(false);
    }
  };

  const handleSendMessage = async () => {
    if (!sendForm.to || !sendForm.message) {
      toast.error('Phone number and message are required');
      return;
    }
    try {
      setSending(true);
      await apiClient.sendWhatsAppMessage({
        to: sendForm.to,
        message: sendForm.message,
        mediaUrl: sendForm.mediaUrl || undefined,
      });
      toast.success('Message sent successfully');
      setSendForm({ to: '', message: '', mediaUrl: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleSendTemplate = async () => {
    if (!templateSendForm.to || !templateSendForm.templateName) {
      toast.error('Phone number and template are required');
      return;
    }
    try {
      setSendingTemplate(true);
      const variables: Record<string, string> = {};
      if (templateSendForm.variables) {
        templateSendForm.variables.split(',').forEach((pair) => {
          const [key, value] = pair.split('=').map((s) => s.trim());
          if (key && value) variables[key] = value;
        });
      }
      await apiClient.sendWhatsAppTemplateMessage({
        to: templateSendForm.to,
        templateName: templateSendForm.templateName,
        variables,
      });
      toast.success('Template message sent successfully');
      setTemplateSendForm({ to: '', templateName: '', variables: '' });
    } catch (err: any) {
      toast.error(err.message || 'Failed to send template message');
    } finally {
      setSendingTemplate(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'conversations', label: 'Conversations' },
    { key: 'templates', label: 'Templates' },
    { key: 'send', label: 'Send Message' },
  ];

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-hos-text-secondary">WhatsApp Management</h1>

        {/* Tabs */}
        <div className="border-b border-hos-border">
          <nav className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 px-1 border-b-2 text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'border-hos-gold text-hos-gold'
                    : 'border-transparent text-hos-text-muted hover:text-hos-text-secondary hover:border-hos-border'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Conversations Tab */}
        {activeTab === 'conversations' && (
          <div>
            {loadingConversations ? (
              <div className="flex items-center justify-center h-64">
                <div className="text-hos-text-muted">Loading conversations...</div>
              </div>
            ) : (
              <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-hos-border">
                  <thead className="bg-hos-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-xs font-medium text-hos-text-muted uppercase text-center">Phone Number</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Last Message</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Created</th>
                    </tr>
                  </thead>
                  <tbody className="bg-hos-bg-secondary divide-y divide-hos-border">
                    {conversations.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-center text-hos-text-muted">No conversations found</td>
                      </tr>
                    ) : (
                      conversations.map((conv) => (
                        <tr key={conv.id}>
                          <td colSpan={4} className="p-0">
                            <button
                              onClick={() => handleConversationClick(conv.id)}
                              className="w-full text-left hover:bg-hos-bg-tertiary transition-colors"
                            >
                              <div className="flex">
                                <div className="px-6 py-4 whitespace-nowrap text-sm font-medium flex-1 text-center">{conv.phoneNumber}</div>
                                <div className="px-6 py-4 whitespace-nowrap flex-1">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    conv.status === 'ACTIVE' ? 'bg-green-500/15 text-green-300' :
                                    conv.status === 'ARCHIVED' ? 'bg-hos-bg-tertiary text-hos-text-secondary' :
                                    'bg-red-500/15 text-red-300'
                                  }`}>
                                    {conv.status}
                                  </span>
                                </div>
                                <div className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted flex-1">
                                  {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString() : 'No messages'}
                                </div>
                                <div className="px-6 py-4 whitespace-nowrap text-sm text-hos-text-muted flex-1">
                                  {new Date(conv.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </button>

                            {/* Expanded message thread */}
                            {expandedConversation === conv.id && (
                              <div className="px-6 py-4 border-t border-hos-border bg-hos-bg-tertiary">
                                {loadingMessages ? (
                                  <div className="text-hos-text-muted text-sm py-2">Loading messages...</div>
                                ) : messages.length === 0 ? (
                                  <div className="text-hos-text-muted text-sm py-2">No messages in this conversation</div>
                                ) : (
                                  <div className="space-y-3 max-h-80 overflow-y-auto">
                                    {messages.map((msg, idx) => (
                                      <div
                                        key={msg.id || idx}
                                        className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
                                      >
                                        <div className={`max-w-[70%] rounded-lg px-4 py-2 text-sm ${
                                          msg.direction === 'OUTBOUND'
                                            ? 'bg-hos-gold/20 text-hos-text-secondary'
                                            : 'bg-hos-bg-secondary text-hos-text-secondary'
                                        }`}>
                                          <p>{msg.content || msg.body || msg.message}</p>
                                          <p className="text-xs text-hos-text-muted mt-1">
                                            {msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ''}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            {/* Create Template Form */}
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Create Template</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Name</label>
                  <input
                    type="text"
                    value={newTemplate.name}
                    onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                    className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="Template name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Category</label>
                  <select
                    value={newTemplate.category}
                    onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                    className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                  >
                    <option value="MARKETING">Marketing</option>
                    <option value="UTILITY">Utility</option>
                    <option value="AUTHENTICATION">Authentication</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Content</label>
                  <textarea
                    value={newTemplate.content}
                    onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="Template content with {{variable}} placeholders"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Variables (comma-separated)</label>
                  <input
                    type="text"
                    value={newTemplate.variables}
                    onChange={(e) => setNewTemplate({ ...newTemplate, variables: e.target.value })}
                    className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="e.g. name, orderNumber, amount"
                  />
                </div>
              </div>
              <button
                onClick={handleCreateTemplate}
                disabled={creatingTemplate}
                className="mt-4 px-4 py-2 bg-hos-gold text-black font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {creatingTemplate ? 'Creating...' : 'Create Template'}
              </button>
            </div>

            {/* Templates List */}
            <div className="bg-hos-bg-secondary rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-hos-border">
                <h2 className="text-lg font-semibold text-hos-text-secondary">Templates</h2>
              </div>
              {loadingTemplates ? (
                <div className="p-6 text-hos-text-muted">Loading templates...</div>
              ) : templates.length === 0 ? (
                <div className="p-6 text-hos-text-muted">No templates found</div>
              ) : (
                <table className="min-w-full divide-y divide-hos-border">
                  <thead className="bg-hos-bg-secondary">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Content</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-hos-text-muted uppercase">Variables</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hos-border">
                    {templates.map((tpl) => (
                      <tr key={tpl.id || tpl.name}>
                        <td className="px-6 py-4 text-sm font-medium text-hos-text-secondary">{tpl.name}</td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-1 text-xs rounded-full bg-hos-gold/15 text-hos-gold">{tpl.category}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-hos-text-muted max-w-xs truncate">{tpl.content}</td>
                        <td className="px-6 py-4 text-sm text-hos-text-muted">
                          {tpl.variables?.join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* Send Message Tab */}
        {activeTab === 'send' && (
          <div className="space-y-6">
            {/* Direct Message */}
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Send Direct Message</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Phone Number *</label>
                  <input
                    type="text"
                    value={sendForm.to}
                    onChange={(e) => setSendForm({ ...sendForm, to: e.target.value })}
                    className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="+971501234567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Message *</label>
                  <textarea
                    value={sendForm.message}
                    onChange={(e) => setSendForm({ ...sendForm, message: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="Type your message here..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Media URL (optional)</label>
                  <input
                    type="text"
                    value={sendForm.mediaUrl}
                    onChange={(e) => setSendForm({ ...sendForm, mediaUrl: e.target.value })}
                    className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="https://example.com/image.jpg"
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={sending}
                  className="px-4 py-2 bg-hos-gold text-black font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </div>

            {/* Send Template */}
            <div className="bg-hos-bg-secondary rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold text-hos-text-secondary mb-4">Send Template Message</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Phone Number *</label>
                  <input
                    type="text"
                    value={templateSendForm.to}
                    onChange={(e) => setTemplateSendForm({ ...templateSendForm, to: e.target.value })}
                    className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="+971501234567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Template *</label>
                  <select
                    value={templateSendForm.templateName}
                    onChange={(e) => setTemplateSendForm({ ...templateSendForm, templateName: e.target.value })}
                    className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                  >
                    <option value="">Select a template</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id || tpl.name} value={tpl.name}>{tpl.name}</option>
                    ))}
                  </select>
                  {templates.length === 0 && (
                    <p className="text-xs text-hos-text-muted mt-1">
                      No templates loaded. Switch to the Templates tab to load them.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-hos-text-muted mb-1">Variables (key=value, comma-separated)</label>
                  <input
                    type="text"
                    value={templateSendForm.variables}
                    onChange={(e) => setTemplateSendForm({ ...templateSendForm, variables: e.target.value })}
                    className="w-full px-3 py-2 bg-hos-bg-secondary border border-hos-border rounded-lg text-hos-text-secondary focus:outline-none focus:ring-2 focus:ring-hos-gold/50"
                    placeholder="name=John, orderNumber=12345"
                  />
                </div>
                <button
                  onClick={handleSendTemplate}
                  disabled={sendingTemplate}
                  className="px-4 py-2 bg-hos-gold text-black font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {sendingTemplate ? 'Sending...' : 'Send Template'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
