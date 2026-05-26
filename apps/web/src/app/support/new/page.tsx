'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';

const CATEGORIES = [
  { value: 'ORDER_INQUIRY', label: 'Order Inquiry' },
  { value: 'PRODUCT_QUESTION', label: 'Product Question' },
  { value: 'RETURN_REQUEST', label: 'Return Request' },
  { value: 'PAYMENT_ISSUE', label: 'Payment Issue' },
  { value: 'TECHNICAL_SUPPORT', label: 'Technical Support' },
  { value: 'SELLER_SUPPORT', label: 'Seller Support' },
  { value: 'OTHER', label: 'Other' },
] as const;

const PRIORITIES = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
] as const;

export default function SubmitTicketPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    subject: '',
    category: 'ORDER_INQUIRY',
    priority: 'MEDIUM',
    description: '',
    orderId: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.description.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      setSubmitting(true);
      const payload: Record<string, string> = {
        subject: formData.subject.trim(),
        category: formData.category,
        priority: formData.priority,
        initialMessage: formData.description.trim(),
      };
      if (formData.orderId.trim()) {
        payload.orderId = formData.orderId.trim();
      }
      const response = await apiClient.createSupportTicket(payload);
      if (response?.data?.id) {
        setTicketId(response.data.id);
      }
      setSubmitted(true);
      toast.success('Support ticket submitted successfully');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to submit ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-hos-bg-secondary">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="max-w-md mx-auto text-center">
            <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-hos-text-secondary mb-2">Ticket Submitted</h1>
            <p className="text-hos-text-secondary mb-6">
              Your support ticket has been created. We&apos;ll get back to you as soon as possible.
            </p>
            {ticketId && (
              <p className="text-sm text-hos-text-muted mb-6">
                Ticket ID: <span className="font-mono font-medium">{ticketId.slice(0, 8)}...</span>
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => {
                  setSubmitted(false);
                  setTicketId(null);
                  setFormData({ subject: '', category: 'ORDER_INQUIRY', priority: 'MEDIUM', description: '', orderId: '' });
                }}
                className="px-6 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover font-medium"
              >
                Submit Another Ticket
              </button>
              <Link
                href="/help"
                className="px-6 py-2 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary font-medium text-center"
              >
                Back to Help Center
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="max-w-2xl mx-auto">
          <Link href="/help" className="text-hos-gold hover:text-hos-gold-hover mb-4 inline-block">
            &larr; Back to Help Center
          </Link>

          <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-bold mb-2">Submit a Support Ticket</h1>
            <p className="text-hos-text-secondary mb-6">
              Describe your issue and our team will respond within 24 hours.
            </p>

            {!user && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6">
                <p className="text-sm text-amber-300">
                  <strong>Note:</strong> You need to be{' '}
                  <Link href="/login" className="underline font-medium">logged in</Link>{' '}
                  to submit a support ticket.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  id="subject"
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                  placeholder="Brief summary of your issue"
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-hos-text-secondary mb-1">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-hos-text-secondary mb-1">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="orderId" className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Order ID <span className="text-hos-text-muted">(optional)</span>
                </label>
                <input
                  id="orderId"
                  type="text"
                  value={formData.orderId}
                  onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                  placeholder="Enter order ID or order number (e.g., ORD-20260414-XXXX)"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-hos-text-secondary mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50 focus:border-hos-gold"
                  rows={6}
                  placeholder="Please describe your issue in detail..."
                  maxLength={5000}
                />
                <p className="text-xs text-hos-text-muted mt-1">
                  {formData.description.length}/5000 characters
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={submitting || !user}
                  className="px-6 py-2.5 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Ticket'}
                </button>
                <Link
                  href="/help"
                  className="px-6 py-2.5 border border-hos-border text-hos-text-secondary rounded-lg hover:bg-hos-bg-tertiary font-medium text-center transition-colors"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
