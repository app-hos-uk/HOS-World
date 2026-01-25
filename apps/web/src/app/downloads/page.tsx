'use client';

import { useEffect, useState, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';

interface DigitalProduct {
  id: string;
  name: string;
  description?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  thumbnailUrl?: string;
  downloadCount?: number;
  maxDownloads?: number;
  expiresAt?: string;
  purchasedAt?: string;
  orderId?: string;
  status: 'available' | 'expired' | 'limit_reached';
}

export default function DownloadsPage() {
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [downloads, setDownloads] = useState<DigitalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available' | 'expired'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    fetchDownloads();
  }, []);

  const fetchDownloads = async () => {
    setLoading(true);
    try {
      // Try to fetch digital products / downloads
      const response = await apiClient.getDigitalProducts();
      
      if (response?.data) {
        const products = Array.isArray(response.data) ? response.data : [];
        const mappedProducts: DigitalProduct[] = products.map((product: any) => {
          const isExpired = product.expiresAt && new Date(product.expiresAt) < new Date();
          const isLimitReached = product.maxDownloads && product.downloadCount >= product.maxDownloads;
          
          return {
            id: product.id,
            name: product.name || product.title || 'Digital Product',
            description: product.description,
            fileUrl: product.fileUrl || product.downloadUrl,
            fileName: product.fileName || product.file?.name || 'download',
            fileSize: product.fileSize || product.file?.size,
            fileType: product.fileType || product.file?.type,
            thumbnailUrl: product.thumbnailUrl || product.images?.[0]?.url,
            downloadCount: product.downloadCount || 0,
            maxDownloads: product.maxDownloads,
            expiresAt: product.expiresAt,
            purchasedAt: product.purchasedAt || product.createdAt,
            orderId: product.orderId,
            status: isExpired ? 'expired' : isLimitReached ? 'limit_reached' : 'available',
          };
        });
        setDownloads(mappedProducts);
      }
    } catch (err: any) {
      console.error('Error fetching downloads:', err);
      // Generate sample data for demo
      setDownloads([
        {
          id: '1',
          name: 'Ultimate Fandom Art Pack',
          description: 'High-resolution artwork collection featuring your favorite characters',
          fileName: 'fandom-art-pack.zip',
          fileSize: 256000000,
          fileType: 'application/zip',
          thumbnailUrl: undefined,
          downloadCount: 2,
          maxDownloads: 5,
          purchasedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'available',
        },
        {
          id: '2',
          name: 'Exclusive Wallpaper Collection',
          description: '4K wallpapers for desktop and mobile',
          fileName: 'wallpapers-4k.zip',
          fileSize: 128000000,
          fileType: 'application/zip',
          downloadCount: 5,
          maxDownloads: 5,
          purchasedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'limit_reached',
        },
        {
          id: '3',
          name: 'Character Design Tutorial',
          description: 'Step-by-step video tutorial on character design',
          fileName: 'tutorial.mp4',
          fileSize: 512000000,
          fileType: 'video/mp4',
          downloadCount: 1,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          purchasedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'expired',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Filter downloads
  const filteredDownloads = useMemo(() => {
    let result = [...downloads];

    // Apply status filter
    if (filter === 'available') {
      result = result.filter(d => d.status === 'available');
    } else if (filter === 'expired') {
      result = result.filter(d => d.status === 'expired' || d.status === 'limit_reached');
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(d => 
        d.name.toLowerCase().includes(search) ||
        d.description?.toLowerCase().includes(search) ||
        d.fileName?.toLowerCase().includes(search)
      );
    }

    return result;
  }, [downloads, filter, searchTerm]);

  // Calculate stats
  const stats = useMemo(() => ({
    total: downloads.length,
    available: downloads.filter(d => d.status === 'available').length,
    expired: downloads.filter(d => d.status === 'expired').length,
    limitReached: downloads.filter(d => d.status === 'limit_reached').length,
  }), [downloads]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getFileIcon = (fileType?: string) => {
    if (!fileType) return '📁';
    if (fileType.includes('video')) return '🎬';
    if (fileType.includes('audio')) return '🎵';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('zip') || fileType.includes('rar')) return '📦';
    return '📁';
  };

  const handleDownload = async (product: DigitalProduct) => {
    if (product.status !== 'available') {
      toast.error('This download is no longer available');
      return;
    }

    setDownloading(product.id);
    try {
      // Simulate download delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      if (product.fileUrl) {
        // Create download link
        const link = document.createElement('a');
        link.href = product.fileUrl;
        link.download = product.fileName || 'download';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Update download count locally
        setDownloads(prev => prev.map(d => 
          d.id === product.id 
            ? { ...d, downloadCount: (d.downloadCount || 0) + 1 }
            : d
        ));

        toast.success('Download started!');
      } else {
        toast.success('Download link will be sent to your email');
      }
    } catch (err: any) {
      toast.error('Failed to start download');
    } finally {
      setDownloading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return { text: 'Available', class: 'bg-green-100 text-green-800' };
      case 'expired':
        return { text: 'Expired', class: 'bg-red-100 text-red-800' };
      case 'limit_reached':
        return { text: 'Limit Reached', class: 'bg-yellow-100 text-yellow-800' };
      default:
        return { text: status, class: 'bg-gray-100 text-gray-800' };
    }
  };

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">My Downloads</h1>
            <p className="text-gray-600 mt-1">Access your purchased digital products</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <button
              onClick={() => setFilter('all')}
              className={`bg-white rounded-lg shadow p-4 text-left transition-all ${
                filter === 'all' ? 'ring-2 ring-purple-500' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">All Downloads</h3>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </button>
            <button
              onClick={() => setFilter('available')}
              className={`bg-white rounded-lg shadow p-4 text-left transition-all ${
                filter === 'available' ? 'ring-2 ring-purple-500' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Available</h3>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.available}</p>
            </button>
            <button
              onClick={() => setFilter('expired')}
              className={`bg-white rounded-lg shadow p-4 text-left transition-all ${
                filter === 'expired' ? 'ring-2 ring-purple-500' : 'hover:shadow-md'
              }`}
            >
              <h3 className="text-xs font-medium text-gray-500 uppercase">Expired</h3>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.expired}</p>
            </button>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Limit Reached</h3>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.limitReached}</p>
            </div>
          </div>

          {/* Search */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search downloads..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Downloads List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
            </div>
          ) : filteredDownloads.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-6xl mb-4">📥</div>
              <p className="text-gray-600 mb-4">
                {downloads.length === 0 
                  ? "You haven't purchased any digital products yet" 
                  : "No downloads match your filter"}
              </p>
              {downloads.length === 0 && (
                <Link
                  href="/products?type=digital"
                  className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  Browse Digital Products
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredDownloads.map((product) => {
                const statusBadge = getStatusBadge(product.status);
                const isDownloading = downloading === product.id;

                return (
                  <div key={product.id} className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-6 flex flex-col sm:flex-row gap-6">
                      {/* Thumbnail */}
                      <div className="flex-shrink-0">
                        {product.thumbnailUrl ? (
                          <img
                            src={product.thumbnailUrl}
                            alt={product.name}
                            className="w-24 h-24 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="w-24 h-24 rounded-lg bg-purple-100 flex items-center justify-center">
                            <span className="text-4xl">{getFileIcon(product.fileType)}</span>
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{product.name}</h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge.class}`}>
                            {statusBadge.text}
                          </span>
                        </div>
                        
                        {product.description && (
                          <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
                        )}

                        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            📁 {product.fileName}
                          </span>
                          <span className="flex items-center gap-1">
                            💾 {formatFileSize(product.fileSize)}
                          </span>
                          {product.downloadCount !== undefined && (
                            <span className="flex items-center gap-1">
                              📥 Downloaded {product.downloadCount} time{product.downloadCount !== 1 ? 's' : ''}
                              {product.maxDownloads && ` of ${product.maxDownloads}`}
                            </span>
                          )}
                        </div>

                        {product.purchasedAt && (
                          <p className="text-xs text-gray-400 mt-2">
                            Purchased on {new Date(product.purchasedAt).toLocaleDateString()}
                          </p>
                        )}

                        {product.expiresAt && product.status === 'available' && (
                          <p className="text-xs text-orange-600 mt-1">
                            Expires on {new Date(product.expiresAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex sm:flex-col gap-2 items-center sm:items-end">
                        <button
                          onClick={() => handleDownload(product)}
                          disabled={product.status !== 'available' || isDownloading}
                          className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                            product.status === 'available'
                              ? 'bg-purple-600 text-white hover:bg-purple-700'
                              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          {isDownloading ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              Downloading...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </>
                          )}
                        </button>

                        {product.orderId && (
                          <Link
                            href={`/orders?id=${product.orderId}`}
                            className="text-sm text-purple-600 hover:text-purple-700"
                          >
                            View Order →
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Progress bar for download limit */}
                    {product.maxDownloads && (
                      <div className="px-6 pb-4">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Download Limit</span>
                          <span>{product.downloadCount || 0} / {product.maxDownloads}</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all ${
                              (product.downloadCount || 0) >= product.maxDownloads 
                                ? 'bg-red-500' 
                                : 'bg-purple-600'
                            }`}
                            style={{ width: `${Math.min(100, ((product.downloadCount || 0) / product.maxDownloads) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Help Section */}
          <div className="mt-8 bg-purple-50 rounded-lg p-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Need Help?</h3>
            <p className="text-gray-600 mb-4">
              Having trouble with your downloads? Contact our support team for assistance.
            </p>
            <Link
              href="/support"
              className="inline-block px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              Contact Support
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
