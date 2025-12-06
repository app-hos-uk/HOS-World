'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { AdminLayout } from '@/components/AdminLayout';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';

export default function AdminFinancePage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'transactions' | 'payouts' | 'refunds' | 'reports'>('transactions');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [refunds, setRefunds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      setLoading(true);
      switch (activeTab) {
        case 'transactions': {
          const txResponse = await apiClient.getTransactions();
          // Handle different response structures
          let txData: any[] = [];
          if (txResponse && 'data' in txResponse) {
            const responseData = txResponse.data as any;
            if (Array.isArray(responseData)) {
              txData = responseData;
            } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
              txData = responseData.data;
            }
          }
          setTransactions(txData);
          break;
        }
        case 'payouts': {
          const payoutResponse = await apiClient.getPayouts();
          let payoutData: any[] = [];
          if (payoutResponse && 'data' in payoutResponse) {
            const responseData = payoutResponse.data as any;
            if (Array.isArray(responseData)) {
              payoutData = responseData;
            } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
              payoutData = responseData.data;
            }
          }
          setPayouts(payoutData);
          break;
        }
        case 'refunds': {
          const refundResponse = await apiClient.getRefunds();
          let refundData: any[] = [];
          if (refundResponse && 'data' in refundResponse) {
            const responseData = refundResponse.data as any;
            if (Array.isArray(responseData)) {
              refundData = responseData;
            } else if (responseData && typeof responseData === 'object' && 'data' in responseData && Array.isArray(responseData.data)) {
              refundData = responseData.data;
            }
          }
          setRefunds(refundData);
          break;
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load data');
      // Set empty arrays on error to prevent map errors
      if (activeTab === 'transactions') setTransactions([]);
      if (activeTab === 'payouts') setPayouts([]);
      if (activeTab === 'refunds') setRefunds([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RouteGuard allowedRoles={['ADMIN']}>
      <AdminLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>

          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {(['transactions', 'payouts', 'refunds', 'reports'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab
                      ? 'border-purple-500 text-purple-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-gray-500">Loading...</div>
            </div>
          ) : (
            <>
              {activeTab === 'transactions' && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No transactions found</td>
                        </tr>
                      ) : (
                        transactions.map((tx) => (
                          <tr key={tx.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{tx.type}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{tx.currency} {tx.amount}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                tx.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {tx.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'payouts' && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Seller</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {payouts.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No payouts found</td>
                        </tr>
                      ) : (
                        payouts.map((payout) => (
                          <tr key={payout.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{payout.sellerId}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{payout.currency} {payout.amount}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                payout.status === 'PAID' ? 'bg-green-100 text-green-800' :
                                payout.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {payout.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(payout.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'refunds' && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {refunds.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-6 py-4 text-center text-gray-500">No refunds found</td>
                        </tr>
                      ) : (
                        refunds.map((refund) => (
                          <tr key={refund.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{refund.orderId}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">{refund.currency} {refund.amount}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                refund.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                refund.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              }`}>
                                {refund.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(refund.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {activeTab === 'reports' && (
                <RevenueReportsTab />
              )}
            </>
          )}
        </div>
      </AdminLayout>
    </RouteGuard>
  );
}

function RevenueReportsTab() {
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const toast = useToast();

  const fetchReport = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getRevenueReport(dateRange.startDate, dateRange.endDate);
      if (response?.data) {
        setReportData(response.data);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to load revenue report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange.startDate, dateRange.endDate]);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <h2 className="text-lg font-semibold">Revenue Reports</h2>
        <div className="flex gap-2">
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading revenue report...</div>
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Revenue</div>
              <div className="text-2xl font-bold text-purple-900">
                {reportData.totalRevenue ? `£${Number(reportData.totalRevenue).toFixed(2)}` : 'N/A'}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Platform Fees</div>
              <div className="text-2xl font-bold text-green-900">
                {reportData.platformFees ? `£${Number(reportData.platformFees).toFixed(2)}` : 'N/A'}
              </div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Seller Payouts</div>
              <div className="text-2xl font-bold text-blue-900">
                {reportData.sellerPayouts ? `£${Number(reportData.sellerPayouts).toFixed(2)}` : 'N/A'}
              </div>
            </div>
          </div>
          {reportData.breakdown && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Revenue Breakdown</h3>
              <pre className="text-xs overflow-auto">{JSON.stringify(reportData.breakdown, null, 2)}</pre>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">No revenue data available for the selected period</div>
      )}
    </div>
  );
}

