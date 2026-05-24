'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';

export default function FulfillmentShipmentsPage() {
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');
  const [selectedShipment, setSelectedShipment] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string>('VERIFIED');
  const [verificationNotes, setVerificationNotes] = useState<string>('');
  const [trackingNumber, setTrackingNumber] = useState<string>('');

  const menuItems = [
    { title: 'Dashboard', href: '/fulfillment/dashboard', icon: '📊' },
    { title: 'Manage Shipments', href: '/fulfillment/shipments', icon: '🚚', badge: shipments.filter(s => s.status === 'PENDING').length },
    { title: 'Centers', href: '/fulfillment/centers', icon: '🏭' },
  ];

  useEffect(() => {
    fetchShipments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getFulfillmentShipments(statusFilter);
      if (response?.data) {
        setShipments(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching shipments:', err);
      setError(err.message || 'Failed to load shipments');
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (shipmentId: string) => {
    try {
      const response = await apiClient.getFulfillmentShipment(shipmentId);
      if (response?.data) {
        setSelectedShipment(response.data);
        setShowModal(true);
      }
    } catch (err: any) {
      console.error('Error fetching shipment details:', err);
      setError(err.message || 'Failed to load shipment details');
    }
  };

  const handleVerify = async () => {
    if (!selectedShipment) return;

    try {
      setActionLoading(true);
      await apiClient.verifyShipment(selectedShipment.id, {
        status: verificationStatus,
        verificationNotes: verificationNotes || undefined,
        trackingNumber: trackingNumber || undefined,
      });
      setShowModal(false);
      setSelectedShipment(null);
      setVerificationNotes('');
      setTrackingNumber('');
      await fetchShipments();
    } catch (err: any) {
      console.error('Error verifying shipment:', err);
      setError(err.message || 'Failed to verify shipment');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-500/15 text-yellow-300';
      case 'VERIFIED':
        return 'bg-green-500/15 text-green-300';
      case 'REJECTED':
        return 'bg-red-500/15 text-red-300';
      case 'IN_TRANSIT':
        return 'bg-hos-gold/20 text-hos-gold';
      default:
        return 'bg-hos-bg-tertiary text-white';
    }
  };

  return (
    <RouteGuard allowedRoles={['FULFILLMENT', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout
        role="FULFILLMENT"
        menuItems={menuItems}
        title="Fulfillment"
        backToHref={{ title: 'Admin Dashboard', href: '/admin/dashboard' }}
      >
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Manage Shipments</h1>
          <p className="text-hos-text-secondary mt-2">Verify and manage incoming shipments</p>
        </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/15 border border-red-400 text-red-400 rounded-lg">
              <p className="font-semibold">Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          )}

          {/* Status Filter */}
          <div className="mb-6 flex gap-2 flex-wrap">
            {['PENDING', 'VERIFIED', 'REJECTED', 'IN_TRANSIT'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  statusFilter === status
                    ? 'bg-hos-gold text-[#1a1406]'
                    : 'bg-hos-bg-tertiary text-hos-text-secondary hover:bg-hos-bg-tertiary'
                }`}
              >
                {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-hos-gold"></div>
            </div>
          )}

          {!loading && shipments.length === 0 && (
            <div className="bg-hos-bg-secondary border border-hos-border rounded-lg p-8 text-center">
              <p className="text-hos-text-muted text-lg">No shipments found for this status</p>
            </div>
          )}

          {!loading && shipments.length > 0 && (
            <div className="space-y-4">
              {shipments.map((shipment) => {
                const productData = shipment.submission?.productData || {};
                return (
                  <div
                    key={shipment.id}
                    className="bg-hos-bg-secondary border border-hos-border rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              {productData.name || 'Unknown Product'}
                            </h3>
                            <p className="text-sm text-hos-text-muted mt-1">
                              Seller: {shipment.submission?.seller?.storeName || 'Unknown'}
                            </p>
                            {shipment.trackingNumber && (
                              <p className="text-sm text-hos-text-muted">
                                Tracking: {shipment.trackingNumber}
                              </p>
                            )}
                          </div>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadgeColor(
                              shipment.status
                            )}`}
                          >
                            {shipment.status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-hos-text-secondary">
                          {shipment.fulfillmentCenter && (
                            <span>
                              <strong>Fulfillment Center:</strong> {shipment.fulfillmentCenter.name}
                            </span>
                          )}
                          <span>
                            <strong>Received:</strong>{' '}
                            {shipment.createdAt
                              ? new Date(shipment.createdAt).toLocaleDateString()
                              : 'N/A'}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 sm:flex-col">
                        <button
                          onClick={() => handleViewDetails(shipment.id)}
                          className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg hover:bg-hos-gold-hover transition-colors font-medium text-sm whitespace-nowrap"
                        >
                          View Details
                        </button>
                        {(shipment.status === 'PENDING' || shipment.status === 'IN_TRANSIT') && (
                          <button
                            onClick={() => {
                              setSelectedShipment(shipment);
                              setVerificationStatus('VERIFIED');
                              setShowModal(true);
                              setVerificationNotes('');
                              setTrackingNumber('');
                            }}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap"
                          >
                            Verify
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Verification Modal */}
          {showModal && selectedShipment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-hos-bg-secondary rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold">Verify Shipment</h2>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setSelectedShipment(null);
                      }}
                      className="text-hos-text-muted hover:text-hos-text-secondary"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-hos-text-muted">Product</p>
                      <p className="text-white">
                        {selectedShipment.submission?.productData?.name || 'Unknown'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Verification Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={verificationStatus}
                        onChange={(e) => setVerificationStatus(e.target.value)}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                      >
                        <option value="VERIFIED">Verified</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Tracking Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                        placeholder="Enter tracking number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-hos-text-secondary mb-1">
                        Verification Notes (Optional)
                      </label>
                      <textarea
                        value={verificationNotes}
                        onChange={(e) => setVerificationNotes(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 border border-hos-border rounded-lg focus:ring-2 focus:ring-hos-gold/50"
                        placeholder="Add verification notes..."
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={handleVerify}
                        disabled={actionLoading}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                      >
                        {actionLoading ? 'Processing...' : 'Verify Shipment'}
                      </button>
                      <button
                        onClick={() => {
                          setShowModal(false);
                          setSelectedShipment(null);
                        }}
                        disabled={actionLoading}
                        className="px-6 py-2 bg-hos-bg-tertiary text-hos-text-secondary rounded-lg hover:bg-hos-text-muted transition-colors font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
      </DashboardLayout>
    </RouteGuard>
  );
}

