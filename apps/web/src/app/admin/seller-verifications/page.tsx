'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

interface VerificationDocument {
  id: string;
  documentType: string;
  fileUrl: string;
  fileName?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNotes?: string;
  createdAt: string;
  reviewedAt?: string;
  seller?: {
    id: string;
    storeName?: string;
    vendorStatus?: string;
    sellerType?: string;
  };
}

export default function AdminSellerVerificationsPage() {
  const toast = useToast();
  const [documents, setDocuments] = useState<VerificationDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [notesDocId, setNotesDocId] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getVerificationDocuments();
      setDocuments(response?.data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load verification documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      setSubmittingId(id);
      await apiClient.reviewVerificationDocument(id, {
        status,
        reviewNotes: reviewNotes.trim() || undefined,
      });
      toast.success(`Document ${status.toLowerCase()}`);
      setReviewNotes('');
      setNotesDocId(null);
      await fetchDocuments();
    } catch (err: any) {
      toast.error(err.message || 'Review failed');
    } finally {
      setSubmittingId(null);
    }
  };

  const filtered = documents.filter((d) => statusFilter === 'ALL' || d.status === statusFilter);
  const pendingCount = documents.filter((d) => d.status === 'PENDING').length;

  return (
    <RouteGuard allowedRoles={['ADMIN', 'FINANCE']}>
              <div className="mb-6">
          <h1 className="text-2xl font-bold text-hos-text-secondary">Seller Verification Queue</h1>
          <p className="text-hos-text-muted text-sm mt-1">
            Review wholesaler and seller identity documents
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-yellow-900/30 text-yellow-400 rounded text-xs">
                {pendingCount} pending
              </span>
            )}
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-hos-gold text-[#1a1406]'
                  : 'bg-hos-bg-secondary border border-hos-border text-hos-text-secondary hover:bg-hos-bg-tertiary'
              }`}
            >
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-hos-gold border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-hos-bg-secondary border border-hos-border rounded-xl">
            <p className="text-hos-text-muted">No {statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''} verification documents.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((doc) => (
              <div key={doc.id} className="bg-hos-bg-secondary border border-hos-border rounded-xl p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-semibold text-hos-text-secondary">{doc.documentType}</h2>
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        doc.status === 'APPROVED' ? 'bg-green-900/30 text-green-400' :
                        doc.status === 'REJECTED' ? 'bg-red-900/30 text-red-400' :
                        'bg-yellow-900/30 text-yellow-400'
                      }`}>
                        {doc.status}
                      </span>
                    </div>
                    <p className="text-sm text-hos-text-muted mt-1">
                      {doc.seller?.storeName || 'Unknown seller'}
                      {doc.seller?.sellerType ? ` · ${doc.seller.sellerType}` : ''}
                    </p>
                    <p className="text-xs text-hos-text-muted mt-1">
                      Submitted {new Date(doc.createdAt).toLocaleString()}
                    </p>
                    {doc.fileName && (
                      <p className="text-xs text-hos-text-muted mt-1">File: {doc.fileName}</p>
                    )}
                    {doc.reviewNotes && (
                      <p className="text-sm text-hos-text-secondary mt-2">Notes: {doc.reviewNotes}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 border border-hos-border rounded-lg text-sm text-hos-text-secondary hover:bg-hos-bg-tertiary text-center"
                    >
                      View Document
                    </a>
                    {doc.status === 'PENDING' && (
                      <>
                        <input
                          type="text"
                          placeholder="Review notes (optional)"
                          value={notesDocId === doc.id ? reviewNotes : ''}
                          onChange={(e) => {
                            setNotesDocId(doc.id);
                            setReviewNotes(e.target.value);
                          }}
                          className="px-3 py-2 bg-hos-bg-tertiary border border-hos-border rounded-lg text-sm text-hos-text-secondary"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={submittingId === doc.id}
                            onClick={() => handleReview(doc.id, 'APPROVED')}
                            className="flex-1 px-3 py-2 bg-green-700 text-white rounded-lg text-sm hover:bg-green-600 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={submittingId === doc.id}
                            onClick={() => handleReview(doc.id, 'REJECTED')}
                            className="flex-1 px-3 py-2 bg-red-700/80 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </RouteGuard>
  );
}
