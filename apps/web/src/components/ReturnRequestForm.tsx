'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface ReturnRequestFormProps {
  orderId: string;
  orderNumber: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function ReturnRequestForm({
  orderId,
  orderNumber,
  onSuccess,
  onCancel,
}: ReturnRequestFormProps) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await apiClient.createReturn({
        orderId,
        reason,
        notes: notes || undefined,
      });

      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/orders');
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit return request');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700 mb-2">
          Order Number
        </label>
        <input
          type="text"
          id="orderNumber"
          value={orderNumber}
          disabled
          className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
        />
      </div>

      <div>
        <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
          Reason for Return <span className="text-red-500">*</span>
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Please describe why you are returning this item..."
        />
        <p className="mt-1 text-sm text-gray-500">
          Please provide a detailed reason for your return request.
        </p>
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
          Additional Notes (Optional)
        </label>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Any additional information that might help us process your return..."
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="flex gap-4">
        <button
          type="submit"
          disabled={isSubmitting || !reason.trim()}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Return Request'}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <p className="text-sm text-blue-800">
          <strong>What happens next?</strong>
        </p>
        <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
          <li>Your return request will be reviewed by our team</li>
          <li>You&apos;ll receive an email notification once your request is approved</li>
          <li>We&apos;ll provide a return shipping label if approved</li>
          <li>Refunds are processed within 5-10 business days after we receive your return</li>
        </ul>
      </div>
    </form>
  );
}

