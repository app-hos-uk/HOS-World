'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { apiClient } from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';

const STATUS_STEPS = ['CREATED', 'PROCESSING', 'SHIPPED', 'DELIVERED'] as const;

function getStepIndex(status: string): number {
  const normalized = status?.toUpperCase() || '';
  if (normalized === 'PENDING' || normalized === 'CREATED') return 0;
  if (normalized === 'PROCESSING' || normalized === 'IN_TRANSIT') return 1;
  if (normalized === 'SHIPPED' || normalized === 'VERIFIED') return 2;
  if (normalized === 'DELIVERED') return 3;
  return -1;
}

export default function ShipmentDetailPage() {
  const params = useParams();
  const shipmentId = params.id as string;

  const [shipment, setShipment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationNotes, setVerificationNotes] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [showVerifyForm, setShowVerifyForm] = useState(false);

  const menuItems = [
    { title: 'Dashboard', href: '/fulfillment/dashboard', icon: '📊' },
    { title: 'Manage Shipments', href: '/fulfillment/shipments', icon: '🚚' },
    { title: 'Centers', href: '/fulfillment/centers', icon: '🏭' },
  ];

  const fetchShipment = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.getFulfillmentShipment(shipmentId);
      if (response?.data) {
        setShipment(response.data);
      } else {
        setError('Shipment not found');
      }
    } catch (err: any) {
      console.error('Error fetching shipment:', err);
      setError(err.message || 'Failed to load shipment details');
    } finally {
      setLoading(false);
    }
  }, [shipmentId]);

  useEffect(() => {
    if (shipmentId) fetchShipment();
  }, [shipmentId, fetchShipment]);

  const handleVerify = async () => {
    try {
      setVerifying(true);
      await apiClient.verifyShipment(shipmentId, {
        status: 'VERIFIED',
        verificationNotes: verificationNotes || undefined,
      });
      toast.success('Shipment verified successfully');
      setShowVerifyForm(false);
      setVerificationNotes('');
      await fetchShipment();
    } catch (err: any) {
      console.error('Error verifying shipment:', err);
      toast.error(err.message || 'Failed to verify shipment');
    } finally {
      setVerifying(false);
    }
  };

  const currentStepIndex = getStepIndex(shipment?.status);
  const isPending = shipment?.status === 'PENDING' || shipment?.status === 'CREATED' || shipment?.status === 'IN_TRANSIT';

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'PENDING':
      case 'CREATED':
        return 'bg-yellow-100 text-yellow-800';
      case 'PROCESSING':
      case 'IN_TRANSIT':
        return 'bg-blue-100 text-blue-800';
      case 'SHIPPED':
      case 'VERIFIED':
        return 'bg-green-100 text-green-800';
      case 'DELIVERED':
        return 'bg-emerald-100 text-emerald-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <RouteGuard allowedRoles={['FULFILLMENT', 'ADMIN']} showAccessDenied={true}>
      <DashboardLayout role="FULFILLMENT" menuItems={menuItems} title="Fulfillment">
        <div className="mb-6">
          <Link
            href="/fulfillment/shipments"
            className="inline-flex items-center text-sm text-purple-600 hover:text-purple-700 mb-4"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Shipments
          </Link>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Shipment Details</h1>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
            Error: {error}
          </div>
        )}

        {!loading && !error && !shipment && (
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <div className="text-5xl mb-4">📦</div>
            <p className="text-gray-500 text-lg">Shipment not found</p>
            <Link
              href="/fulfillment/shipments"
              className="mt-4 inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              View All Shipments
            </Link>
          </div>
        )}

        {!loading && !error && shipment && (
          <div className="space-y-6">
            {/* Shipment Header */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-bold text-gray-900">
                      Shipment #{shipment.id?.slice(-8)?.toUpperCase() || shipmentId}
                    </h2>
                    <span className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(shipment.status)}`}>
                      {shipment.status?.replace(/_/g, ' ') || 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    {shipment.trackingNumber && (
                      <p><span className="font-medium">Tracking Number:</span> {shipment.trackingNumber}</p>
                    )}
                    {shipment.fulfillmentCenter?.name && (
                      <p><span className="font-medium">Origin Center:</span> {shipment.fulfillmentCenter.name}</p>
                    )}
                    {shipment.destination && (
                      <p><span className="font-medium">Destination:</span> {shipment.destination}</p>
                    )}
                    {shipment.createdAt && (
                      <p><span className="font-medium">Created:</span> {new Date(shipment.createdAt).toLocaleString()}</p>
                    )}
                  </div>
                </div>
                {isPending && (
                  <button
                    onClick={() => setShowVerifyForm(!showVerifyForm)}
                    className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm whitespace-nowrap"
                  >
                    ✓ Verify Shipment
                  </button>
                )}
              </div>
            </div>

            {/* Verification Form */}
            {showVerifyForm && (
              <div className="bg-white border-2 border-green-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Verify This Shipment</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Verification Notes (Optional)
                    </label>
                    <textarea
                      value={verificationNotes}
                      onChange={(e) => setVerificationNotes(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="Add any notes about the verification..."
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleVerify}
                      disabled={verifying}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                    >
                      {verifying ? 'Verifying...' : 'Confirm Verification'}
                    </button>
                    <button
                      onClick={() => {
                        setShowVerifyForm(false);
                        setVerificationNotes('');
                      }}
                      disabled={verifying}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors font-medium"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Status Timeline */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-6">Status Timeline</h3>
              <div className="flex items-center justify-between relative">
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 z-0"></div>
                <div
                  className="absolute top-5 left-0 h-0.5 bg-purple-600 z-0 transition-all duration-500"
                  style={{ width: currentStepIndex >= 0 ? `${(currentStepIndex / (STATUS_STEPS.length - 1)) * 100}%` : '0%' }}
                ></div>
                {STATUS_STEPS.map((step, index) => {
                  const isCompleted = index <= currentStepIndex;
                  const isCurrent = index === currentStepIndex;
                  return (
                    <div key={step} className="flex flex-col items-center relative z-10">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                          isCompleted
                            ? 'bg-purple-600 border-purple-600 text-white'
                            : 'bg-white border-gray-300 text-gray-400'
                        } ${isCurrent ? 'ring-4 ring-purple-200' : ''}`}
                      >
                        {isCompleted ? '✓' : index + 1}
                      </div>
                      <span
                        className={`mt-2 text-xs font-medium ${
                          isCompleted ? 'text-purple-600' : 'text-gray-400'
                        }`}
                      >
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <h3 className="text-lg font-semibold mb-4">Order Items</h3>
              {shipment.items && shipment.items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Item</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">SKU</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Quantity</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipment.items.map((item: any, index: number) => (
                        <tr key={item.id || index} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4 text-gray-900">{item.name || item.productName || 'Unknown'}</td>
                          <td className="py-3 px-4 text-gray-500">{item.sku || 'N/A'}</td>
                          <td className="py-3 px-4 text-right text-gray-900">{item.quantity || 1}</td>
                          <td className="py-3 px-4 text-right text-gray-900">
                            {item.price != null ? `$${Number(item.price).toFixed(2)}` : 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : shipment.submission?.productData ? (
                <div className="p-4 border border-gray-100 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{shipment.submission.productData.name}</p>
                      {shipment.submission.productData.sku && (
                        <p className="text-sm text-gray-500">SKU: {shipment.submission.productData.sku}</p>
                      )}
                    </div>
                    {shipment.submission.productData.price != null && (
                      <p className="font-medium text-gray-900">
                        ${Number(shipment.submission.productData.price).toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No item details available</p>
                </div>
              )}
            </div>

            {/* Verification Info (if verified/rejected) */}
            {(shipment.verificationNotes || shipment.verifiedAt || shipment.verifiedBy) && (
              <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-semibold mb-4">Verification Details</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  {shipment.verifiedAt && (
                    <p><span className="font-medium">Verified At:</span> {new Date(shipment.verifiedAt).toLocaleString()}</p>
                  )}
                  {shipment.verifiedBy && (
                    <p><span className="font-medium">Verified By:</span> {shipment.verifiedBy.name || shipment.verifiedBy.email || shipment.verifiedBy}</p>
                  )}
                  {shipment.verificationNotes && (
                    <div>
                      <p className="font-medium mb-1">Notes:</p>
                      <p className="bg-gray-50 rounded-lg p-3">{shipment.verificationNotes}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}
