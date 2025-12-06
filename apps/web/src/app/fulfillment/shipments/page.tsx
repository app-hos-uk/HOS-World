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
  ];

  useEffect(() => {
    fetchShipments();
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
        return 'bg-yellow-100 text-yellow-800';
      case 'VERIFIED':
        return 'bg-green-100 text-green-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'IN_TRANSIT':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <RouteGuard allowedRoles={['FULFILLMENT', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="FULFILLMENT" menuItems={menuItems} title="Fulfillment">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Manage Shipments</h1>
          <p className="text-gray-600 mt-2">Verify and manage incoming shipments</p>
        </div>

          {error && (
            <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
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
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          )}

          {!loading && shipments.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-8 text-center">
              <p className="text-gray-500 text-lg">No shipments found for this status</p>
            </div>
          )}

          {!loading && shipments.length > 0 && (
            <div className="space-y-4">
              {shipments.map((shipment) => {
                const productData = shipment.submission?.productData || {};
                return (
                  <div
                    key={shipment.id}
                    className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {productData.name || 'Unknown Product'}
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              Seller: {shipment.submission?.seller?.storeName || 'Unknown'}
                            </p>
                            {shipment.trackingNumber && (
                              <p className="text-sm text-gray-500">
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

                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
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
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm whitespace-nowrap"
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
              <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <h2 className="text-2xl font-bold">Verify Shipment</h2>
                    <button
                      onClick={() => {
                        setShowModal(false);
                        setSelectedShipment(null);
                      }}
                      className="text-gray-500 hover:text-gray-700"
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
                      <p className="text-sm font-medium text-gray-500">Product</p>
                      <p className="text-gray-900">
                        {selectedShipment.submission?.productData?.name || 'Unknown'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Verification Status <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={verificationStatus}
                        onChange={(e) => setVerificationStatus(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="VERIFIED">Verified</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tracking Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter tracking number"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Verification Notes (Optional)
                      </label>
                      <textarea
                        value={verificationNotes}
                        onChange={(e) => setVerificationNotes(e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
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
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
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

