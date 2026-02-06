'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { MapPicker } from '@/components/MapPicker';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';
import Image from 'next/image';

interface GamificationStats {
  points: number;
  level: number;
  badgeCount: number;
  completedQuests: number;
  activeQuests: number;
  character?: {
    id: string;
    name: string;
    avatar?: string;
    fandom?: {
      name: string;
      slug: string;
    };
  };
  favoriteFandoms: string[];
  progress: {
    current: number;
    needed: number;
    percentage: number;
    nextLevel: number;
  };
}

interface Badge {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  category: string;
  rarity: string;
  points: number;
  earnedAt: string;
}

interface Collection {
  id: string;
  name: string;
  description?: string;
  itemCount: number;
  isPublic: boolean;
  createdAt: string;
}

function ProfilePageContent() {
  const toast = useToast();
  const searchParams = useSearchParams();
  const { currency, setCurrency } = useCurrency();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<GamificationStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const tabParam = searchParams.get('tab');
  const actionParam = searchParams.get('action');
  const [activeTab, setActiveTab] = useState<'overview' | 'badges' | 'collections' | 'settings' | 'addresses'>(
    tabParam === 'addresses' ? 'addresses' : tabParam === 'settings' ? 'settings' : tabParam === 'badges' ? 'badges' : tabParam === 'collections' ? 'collections' : 'overview'
  );
  
  // Settings form state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    country: '',
    whatsappNumber: '',
    preferredCommunicationMethod: 'EMAIL' as 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PHONE',
    currencyPreference: 'GBP',
    // Marketing dates (optional)
    birthday: '',
    anniversary: '',
  });
  const [gdprConsent, setGdprConsent] = useState<any>(null);
  const [gdprConsentHistory, setGdprConsentHistory] = useState<any[]>([]);
  const [exportingData, setExportingData] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Address management state
  const [addresses, setAddresses] = useState<any[]>([]);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<any>(null);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState({
    label: 'HOME' as 'HOME' | 'WORK' | 'OTHER',
    firstName: '',
    lastName: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    isDefault: false,
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  });

  useEffect(() => {
    fetchProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'addresses') {
      fetchAddresses();
      // Auto-open address form when coming from checkout with action=add
      if (actionParam === 'add') {
        setShowAddressForm(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, actionParam]);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const [profileRes, statsRes, badgesRes, collectionsRes, gdprRes, gdprHistoryRes] = await Promise.all([
        apiClient.getProfile(),
        apiClient.getGamificationStats(),
        apiClient.getBadges(),
        apiClient.getCollections(),
        apiClient.getGDPRConsent().catch(() => null), // May fail if not logged in
        apiClient.getGDPRConsentHistory().catch(() => null), // May fail if not logged in
      ]);

      if (profileRes?.data) {
        setProfile(profileRes.data);
        setFormData({
          firstName: profileRes.data.firstName || '',
          lastName: profileRes.data.lastName || '',
          phone: profileRes.data.phone || '',
          country: profileRes.data.country || '',
          whatsappNumber: profileRes.data.whatsappNumber || '',
          preferredCommunicationMethod: profileRes.data.preferredCommunicationMethod || 'EMAIL',
          currencyPreference: profileRes.data.currencyPreference || 'GBP',
          birthday: profileRes.data.birthday ? new Date(profileRes.data.birthday).toISOString().split('T')[0] : '',
          anniversary: profileRes.data.anniversary ? new Date(profileRes.data.anniversary).toISOString().split('T')[0] : '',
        });
        // Sync currency context
        if (profileRes.data.currencyPreference) {
          setCurrency(profileRes.data.currencyPreference);
        }
      }
      if (statsRes?.data) {
        // Ensure favoriteFandoms is always an array
        const statsData = {
          ...statsRes.data,
          favoriteFandoms: Array.isArray(statsRes.data.favoriteFandoms) 
            ? statsRes.data.favoriteFandoms 
            : []
        };
        setStats(statsData);
      }
      // Ensure badges is always an array
      if (badgesRes?.data) {
        setBadges(Array.isArray(badgesRes.data) ? badgesRes.data : []);
      }
      // Ensure collections is always an array
      if (collectionsRes?.data) {
        setCollections(Array.isArray(collectionsRes.data) ? collectionsRes.data : []);
      }
      if (gdprRes?.data) setGdprConsent(gdprRes.data);
      if (gdprHistoryRes?.data) setGdprConsentHistory(gdprHistoryRes.data);
    } catch (err: any) {
      console.error('Error fetching profile data:', err);
      toast.error(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const response = await apiClient.updateProfile(formData);
      if (response?.data) {
        setProfile(response.data);
        setEditing(false);
        toast.success('Profile updated successfully');
        // Update currency context if changed
        if (formData.currencyPreference !== currency) {
          setCurrency(formData.currencyPreference);
        }
        // Refresh profile data
        await fetchProfileData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateGDPRConsent = async (consentData: { marketing?: boolean; analytics?: boolean; essential?: boolean }) => {
    try {
      await apiClient.updateGDPRConsent(consentData);
      toast.success('Consent preferences updated');
      await fetchProfileData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update consent');
    }
  };

  const handleExportData = async () => {
    try {
      setExportingData(true);
      const response = await apiClient.exportUserData();
      if (response?.data) {
        // Create download
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `hos-user-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('Data exported successfully');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to export data');
    } finally {
      setExportingData(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone. Your data will be anonymized but order history will be retained for legal compliance.')) {
      return;
    }

    try {
      setDeletingAccount(true);
      await apiClient.deleteUserData();
      toast.success('Account deletion initiated. You will be logged out.');
      // Logout and redirect
      setTimeout(() => {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete account');
    } finally {
      setDeletingAccount(false);
    }
  };

  // Address management functions
  const fetchAddresses = async () => {
    try {
      const response = await apiClient.getAddresses();
      // Ensure addresses is always an array
      if (response?.data) {
        setAddresses(Array.isArray(response.data) ? response.data : []);
      } else {
        setAddresses([]);
      }
    } catch (err: any) {
      console.error('Error fetching addresses:', err);
      toast.error(err.message || 'Failed to load addresses');
      setAddresses([]); // Set empty array on error
    }
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingAddress) return; // Prevent double-click
    try {
      setSavingAddress(true);
      if (editingAddress) {
        await apiClient.updateAddress(editingAddress.id, addressForm);
        toast.success('Address updated successfully!');
      } else {
        await apiClient.createAddress(addressForm);
        toast.success('Address added successfully!');
      }
      setShowAddressForm(false);
      setEditingAddress(null);
      setAddressForm({
        label: 'HOME',
        firstName: '',
        lastName: '',
        phone: '',
        street: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
        isDefault: false,
        latitude: undefined,
        longitude: undefined,
      });
      fetchAddresses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save address');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;
    try {
      await apiClient.deleteAddress(id);
      toast.success('Address deleted successfully!');
      fetchAddresses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete address');
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await apiClient.setDefaultAddress(id);
      toast.success('Default address updated!');
      fetchAddresses();
    } catch (err: any) {
      toast.error(err.message || 'Failed to set default address');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <RouteGuard allowedRoles={['CUSTOMER', 'ADMIN']} showAccessDenied={true}>
      <div className="min-h-screen bg-white">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-6 sm:p-8 mb-6 text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-4xl sm:text-5xl overflow-hidden">
                {profile?.avatar ? (
                  <Image
                    src={profile.avatar}
                    alt={profile.firstName || 'User'}
                    width={96}
                    height={96}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <span>{profile?.firstName?.[0] || profile?.email?.[0] || 'U'}</span>
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                  {profile?.firstName && profile?.lastName
                    ? `${profile.firstName} ${profile.lastName}`
                    : profile?.email || 'User'}
                </h1>
                <p className="text-purple-100 text-sm sm:text-base">{profile?.email}</p>
                {stats && (
                  <div className="flex flex-wrap gap-4 mt-4">
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold">Level {stats.level}</div>
                      <div className="text-xs sm:text-sm text-purple-100">Current Level</div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold">{stats.points.toLocaleString()}</div>
                      <div className="text-xs sm:text-sm text-purple-100">Points</div>
                    </div>
                    <div>
                      <div className="text-2xl sm:text-3xl font-bold">{stats.badgeCount}</div>
                      <div className="text-xs sm:text-sm text-purple-100">Badges</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-white border border-gray-200 rounded-lg mb-6">
            <div className="flex flex-wrap border-b border-gray-200">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-4 sm:px-6 py-3 font-medium text-sm sm:text-base transition-colors ${
                  activeTab === 'overview'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('badges')}
                className={`px-4 sm:px-6 py-3 font-medium text-sm sm:text-base transition-colors ${
                  activeTab === 'badges'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Badges ({badges.length})
              </button>
              <button
                onClick={() => setActiveTab('collections')}
                className={`px-4 sm:px-6 py-3 font-medium text-sm sm:text-base transition-colors ${
                  activeTab === 'collections'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Collections ({collections.length})
              </button>
              <button
                onClick={() => setActiveTab('addresses')}
                className={`px-4 sm:px-6 py-3 font-medium text-sm sm:text-base transition-colors ${
                  activeTab === 'addresses'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Addresses
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 sm:px-6 py-3 font-medium text-sm sm:text-base transition-colors ${
                  activeTab === 'settings'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Settings
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Level Progress */}
                {stats && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold">Progress to Level {stats.progress.nextLevel}</h3>
                      <span className="text-sm text-gray-600">
                        {stats.progress.current} / {stats.progress.current + stats.progress.needed} points
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className="bg-gradient-to-r from-purple-600 to-indigo-600 h-4 rounded-full transition-all duration-300"
                        style={{ width: `${stats.progress.percentage}%` }}
                      ></div>
                    </div>
                    <p className="text-sm text-gray-600 mt-2">
                      {stats.progress.needed} more points to reach Level {stats.progress.nextLevel}
                    </p>
                  </div>
                )}

                {/* Character */}
                {stats?.character && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3">Your Character</h3>
                    <div className="flex items-center gap-4">
                      {stats.character.avatar && (
                        <Image
                          src={stats.character.avatar}
                          alt={stats.character.name}
                          width={64}
                          height={64}
                          className="rounded-full object-cover"
                        />
                      )}
                      <div>
                        <div className="font-semibold">{stats.character.name}</div>
                        {stats.character.fandom && (
                          <div className="text-sm text-gray-600">{stats.character.fandom.name}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Favorite Fandoms */}
                {stats && Array.isArray(stats.favoriteFandoms) && stats.favoriteFandoms.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Favorite Fandoms</h3>
                    <div className="flex flex-wrap gap-2">
                      {stats.favoriteFandoms.map((fandom, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium"
                        >
                          {fandom}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quest Stats */}
                {stats && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-blue-600">{stats.activeQuests}</div>
                      <div className="text-sm text-gray-600">Active Quests</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-green-600">{stats.completedQuests}</div>
                      <div className="text-sm text-gray-600">Completed Quests</div>
                    </div>
                  </div>
                )}

                {/* Recent Badges */}
                {badges.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Recent Badges</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      {badges.slice(0, 4).map((badge) => (
                        <div
                          key={badge.id}
                          className="bg-gray-50 rounded-lg p-4 text-center hover:shadow-md transition-shadow"
                        >
                          <div className="text-3xl mb-2">{badge.icon || '🏆'}</div>
                          <div className="text-sm font-medium">{badge.name}</div>
                          <div className="text-xs text-gray-500 mt-1">{badge.category}</div>
                        </div>
                      ))}
                    </div>
                    {badges.length > 4 && (
                      <button
                        onClick={() => setActiveTab('badges')}
                        className="mt-4 text-purple-600 hover:text-purple-800 font-medium text-sm"
                      >
                        View All Badges →
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'badges' && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Your Badges</h2>
                {badges.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🏆</div>
                    <p className="text-gray-600">No badges earned yet</p>
                    <p className="text-sm text-gray-500 mt-2">Complete quests and activities to earn badges!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {badges.map((badge) => (
                      <div
                        key={badge.id}
                        className="bg-gray-50 rounded-lg p-6 hover:shadow-lg transition-shadow"
                      >
                        <div className="text-center">
                          <div className="text-5xl mb-3">{badge.icon || '🏆'}</div>
                          <h3 className="text-lg font-semibold mb-2">{badge.name}</h3>
                          {badge.description && (
                            <p className="text-sm text-gray-600 mb-3">{badge.description}</p>
                          )}
                          <div className="flex items-center justify-center gap-2 text-xs">
                            <span
                              className={`px-2 py-1 rounded ${
                                badge.rarity === 'RARE'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : badge.rarity === 'EPIC'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {badge.rarity}
                            </span>
                            <span className="text-gray-500">{badge.points} points</span>
                          </div>
                          <div className="text-xs text-gray-500 mt-3">
                            Earned {new Date(badge.earnedAt).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'collections' && (
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Your Collections</h2>
                  <Link
                    href="/collections/new"
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                  >
                    + Create Collection
                  </Link>
                </div>
                {collections.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📚</div>
                    <p className="text-gray-600">No collections yet</p>
                    <Link
                      href="/collections/new"
                      className="mt-4 inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                    >
                      Create Your First Collection
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {collections.map((collection) => (
                      <Link
                        key={collection.id}
                        href={`/collections/${collection.id}`}
                        className="bg-gray-50 rounded-lg p-6 hover:shadow-lg transition-shadow block"
                      >
                        <div className="text-4xl mb-3">📚</div>
                        <h3 className="text-lg font-semibold mb-2">{collection.name}</h3>
                        {collection.description && (
                          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{collection.description}</p>
                        )}
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">{collection.itemCount} items</span>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              collection.isPublic
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {collection.isPublic ? 'Public' : 'Private'}
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'addresses' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold">Saved Addresses</h3>
                  <button
                    onClick={() => {
                      setEditingAddress(null);
                      setAddressForm({
                        label: 'HOME',
                        firstName: '',
                        lastName: '',
                        phone: '',
                        street: '',
                        city: '',
                        state: '',
                        postalCode: '',
                        country: '',
                        isDefault: false,
                        latitude: undefined,
                        longitude: undefined,
                      });
                      setShowAddressForm(true);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    + Add Address
                  </button>
                </div>

                {showAddressForm && (
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h4 className="font-semibold mb-4">{editingAddress ? 'Edit' : 'Add'} Address</h4>
                    <form onSubmit={handleSaveAddress} className="space-y-4">
                      {/* Address Label */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Address Type</label>
                        <div className="flex gap-3">
                          {(['HOME', 'WORK', 'OTHER'] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setAddressForm({ ...addressForm, label: type })}
                              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                                addressForm.label === type
                                  ? 'bg-purple-600 text-white border-purple-600'
                                  : 'bg-white text-gray-700 border-gray-300 hover:border-purple-300'
                              }`}
                            >
                              {type === 'HOME' ? '🏠 Home' : type === 'WORK' ? '💼 Work' : '📍 Other'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Contact Details */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                          <input
                            type="text"
                            value={addressForm.firstName}
                            onChange={(e) => setAddressForm({ ...addressForm, firstName: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Recipient first name"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                          <input
                            type="text"
                            value={addressForm.lastName}
                            onChange={(e) => setAddressForm({ ...addressForm, lastName: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="Recipient last name"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                          <input
                            type="tel"
                            value={addressForm.phone}
                            onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="+44 7700 900000"
                          />
                        </div>
                      </div>

                      {/* Address Details */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                          <input
                            type="text"
                            value={addressForm.street}
                            onChange={(e) => setAddressForm({ ...addressForm, street: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="House number and street name"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                          <input
                            type="text"
                            value={addressForm.city}
                            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">State/Province/Region</label>
                          <input
                            type="text"
                            value={addressForm.state}
                            onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
                          <input
                            type="text"
                            value={addressForm.postalCode}
                            onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                          <select
                            value={addressForm.country}
                            onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            required
                          >
                            <option value="">Select country</option>
                            <option value="United Kingdom">United Kingdom</option>
                            <option value="United States">United States</option>
                            <option value="Germany">Germany</option>
                            <option value="France">France</option>
                            <option value="Italy">Italy</option>
                            <option value="Spain">Spain</option>
                            <option value="Netherlands">Netherlands</option>
                            <option value="Belgium">Belgium</option>
                            <option value="Ireland">Ireland</option>
                            <option value="United Arab Emirates">United Arab Emirates</option>
                            <option value="Saudi Arabia">Saudi Arabia</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={addressForm.isDefault}
                          onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                          className="mr-2 rounded border-gray-300 text-purple-600"
                        />
                        <label className="text-sm text-gray-700">Set as default shipping address</label>
                      </div>
                      
                      {/* Map Picker for Location Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Location on Map (Optional)
                        </label>
                        <p className="text-xs text-gray-500 mb-2">
                          Click on the map to set your exact location. This helps with accurate delivery routing.
                        </p>
                        <MapPicker
                          latitude={addressForm.latitude}
                          longitude={addressForm.longitude}
                          onLocationChange={(lat, lng) => {
                            setAddressForm({ ...addressForm, latitude: lat, longitude: lng });
                          }}
                          height="350px"
                          className="w-full"
                        />
                      </div>
                      
                      <div className="flex gap-3">
                        <button
                          type="submit"
                          disabled={savingAddress}
                          className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingAddress ? 'Saving...' : (editingAddress ? 'Update' : 'Add')} Address
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddressForm(false);
                            setEditingAddress(null);
                          }}
                          className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                <div className="space-y-4">
                  {addresses.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No addresses saved. Add your first address above.</p>
                  ) : (
                    addresses.map((address) => (
                      <div key={address.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              {address.label && (
                                <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                                  address.label === 'HOME' ? 'bg-blue-100 text-blue-800' :
                                  address.label === 'WORK' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {address.label === 'HOME' ? '🏠 Home' : address.label === 'WORK' ? '💼 Work' : '📍 Other'}
                                </span>
                              )}
                              {address.isDefault && (
                                <span className="inline-block px-2 py-1 bg-purple-100 text-purple-800 text-xs font-semibold rounded">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="font-medium">
                              {address.firstName && address.lastName 
                                ? `${address.firstName} ${address.lastName}` 
                                : address.street}
                            </p>
                            {address.firstName && <p className="text-gray-600">{address.street}</p>}
                            <p className="text-gray-600">
                              {address.city}{address.state ? `, ${address.state}` : ''} {address.postalCode}
                            </p>
                            <p className="text-gray-600">{address.country}</p>
                            {address.phone && <p className="text-gray-500 text-sm mt-1">📞 {address.phone}</p>}
                          </div>
                          <div className="flex gap-2">
                            {!address.isDefault && (
                              <button
                                onClick={() => handleSetDefault(address.id)}
                                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                              >
                                Set Default
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setEditingAddress(address);
                                setAddressForm({
                                  label: address.label || 'HOME',
                                  firstName: address.firstName || '',
                                  lastName: address.lastName || '',
                                  phone: address.phone || '',
                                  street: address.street,
                                  city: address.city,
                                  state: address.state || '',
                                  postalCode: address.postalCode,
                                  country: address.country,
                                  isDefault: address.isDefault,
                                  latitude: address.latitude,
                                  longitude: address.longitude,
                                });
                                setShowAddressForm(true);
                              }}
                              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteAddress(address.id)}
                              className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Account Settings</h2>
                <div className="space-y-6">
                  {/* Profile Information */}
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold">Profile Information</h3>
                      {!editing && (
                        <button
                          onClick={() => setEditing(true)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
                        >
                          Edit Profile
                        </button>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 sm:p-6 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={profile?.email || ''}
                          disabled
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                        />
                        <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                          <input
                            type="text"
                            value={editing ? formData.firstName : (profile?.firstName || '')}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            disabled={!editing}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                          <input
                            type="text"
                            value={editing ? formData.lastName : (profile?.lastName || '')}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            disabled={!editing}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={editing ? formData.phone : (profile?.phone || '')}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          disabled={!editing}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                        <select
                          value={editing ? formData.country : (profile?.country || '')}
                          onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                          disabled={!editing}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
                        >
                          <option value="">Select country</option>
                          <option value="United Kingdom">United Kingdom</option>
                          <option value="United States">United States</option>
                          <option value="United Arab Emirates">United Arab Emirates</option>
                          <option value="Germany">Germany</option>
                          <option value="France">France</option>
                          <option value="Italy">Italy</option>
                          <option value="Spain">Spain</option>
                          <option value="Netherlands">Netherlands</option>
                          <option value="Belgium">Belgium</option>
                          <option value="Austria">Austria</option>
                          <option value="Portugal">Portugal</option>
                          <option value="Ireland">Ireland</option>
                          <option value="Greece">Greece</option>
                          <option value="Finland">Finland</option>
                          <option value="Saudi Arabia">Saudi Arabia</option>
                          <option value="Kuwait">Kuwait</option>
                          <option value="Qatar">Qatar</option>
                          <option value="Bahrain">Bahrain</option>
                          <option value="Oman">Oman</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                        <input
                          type="tel"
                          value={editing ? formData.whatsappNumber : (profile?.whatsappNumber || '')}
                          onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                          disabled={!editing}
                          placeholder="+44 7700 900000"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
                        />
                        <p className="text-xs text-gray-500 mt-1">Include country code (e.g., +44 for UK)</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Communication Method</label>
                        <select
                          value={editing ? formData.preferredCommunicationMethod : (profile?.preferredCommunicationMethod || 'EMAIL')}
                          onChange={(e) => setFormData({ ...formData, preferredCommunicationMethod: e.target.value as any })}
                          disabled={!editing}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
                        >
                          <option value="EMAIL">Email</option>
                          <option value="SMS">SMS</option>
                          <option value="WHATSAPP">WhatsApp</option>
                          <option value="PHONE">Phone Call</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Currency Preference</label>
                        <select
                          value={editing ? formData.currencyPreference : (profile?.currencyPreference || 'GBP')}
                          onChange={(e) => setFormData({ ...formData, currencyPreference: e.target.value })}
                          disabled={!editing}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
                        >
                          <option value="GBP">£ GBP (British Pound)</option>
                          <option value="USD">$ USD (US Dollar)</option>
                          <option value="EUR">€ EUR (Euro)</option>
                          <option value="AED">د.إ AED (UAE Dirham)</option>
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Prices will be displayed in this currency</p>
                      </div>

                      {/* Special Dates - Optional for marketing */}
                      <div className="border-t pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Special Dates (Optional)</h4>
                        <p className="text-xs text-gray-500 mb-3">Share your special dates to receive personalized offers and birthday surprises!</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Birthday</label>
                            <input
                              type="date"
                              value={editing ? formData.birthday : (profile?.birthday ? new Date(profile.birthday).toISOString().split('T')[0] : '')}
                              onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                              disabled={!editing}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
                            />
                            <p className="text-xs text-gray-500 mt-1">Get birthday discounts and surprises</p>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Anniversary</label>
                            <input
                              type="date"
                              value={editing ? formData.anniversary : (profile?.anniversary ? new Date(profile.anniversary).toISOString().split('T')[0] : '')}
                              onChange={(e) => setFormData({ ...formData, anniversary: e.target.value })}
                              disabled={!editing}
                              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white disabled:bg-gray-100"
                            />
                            <p className="text-xs text-gray-500 mt-1">Receive gift suggestions for special occasions</p>
                          </div>
                        </div>
                      </div>
                      {editing && (
                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={handleSaveProfile}
                            disabled={saving}
                            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button
                            onClick={() => {
                              setEditing(false);
                              // Reset form data
                              setFormData({
                                firstName: profile?.firstName || '',
                                lastName: profile?.lastName || '',
                                phone: profile?.phone || '',
                                country: profile?.country || '',
                                whatsappNumber: profile?.whatsappNumber || '',
                                preferredCommunicationMethod: profile?.preferredCommunicationMethod || 'EMAIL',
                                currencyPreference: profile?.currencyPreference || 'GBP',
                                birthday: profile?.birthday ? new Date(profile.birthday).toISOString().split('T')[0] : '',
                                anniversary: profile?.anniversary ? new Date(profile.anniversary).toISOString().split('T')[0] : '',
                              });
                            }}
                            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* GDPR & Privacy */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Privacy & Data Management</h3>
                    <div className="bg-gray-50 rounded-lg p-4 sm:p-6 space-y-6">
                      {/* GDPR Consent Status */}
                      {gdprConsent && (
                        <div>
                          <h4 className="font-medium mb-3">Consent Preferences</h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                              <div>
                                <div className="font-medium">Essential Cookies</div>
                                <div className="text-sm text-gray-600">Required for site functionality</div>
                              </div>
                              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                                Always Active
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                              <div>
                                <div className="font-medium">Marketing Communications</div>
                                <div className="text-sm text-gray-600">Receive promotional emails and offers</div>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={gdprConsent.dataProcessingConsent?.marketing || false}
                                  onChange={(e) => handleUpdateGDPRConsent({ marketing: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                              </label>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                              <div>
                                <div className="font-medium">Analytics & Tracking</div>
                                <div className="text-sm text-gray-600">Help us improve our services</div>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={gdprConsent.dataProcessingConsent?.analytics || false}
                                  onChange={(e) => handleUpdateGDPRConsent({ analytics: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                              </label>
                            </div>
                          </div>
                          {gdprConsent.gdprConsentDate && (
                            <p className="text-xs text-gray-500 mt-3">
                              Consent given: {new Date(gdprConsent.gdprConsentDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Data Export */}
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3">Data Export (GDPR Article 15)</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Download a copy of all your personal data stored in our system.
                        </p>
                        <button
                          onClick={handleExportData}
                          disabled={exportingData}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 text-sm"
                        >
                          {exportingData ? 'Exporting...' : 'Export My Data'}
                        </button>
                      </div>

                      {/* Account Deletion */}
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-3 text-red-600">Delete Account (GDPR Article 17)</h4>
                        <p className="text-sm text-gray-600 mb-3">
                          Permanently delete your account. Your data will be anonymized, but order history will be retained for legal compliance. This action cannot be undone.
                        </p>
                        <button
                          onClick={handleDeleteAccount}
                          disabled={deletingAccount}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 text-sm"
                        >
                          {deletingAccount ? 'Deleting...' : 'Delete My Account'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Security */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Security</h3>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <Link
                        href="/profile/change-password"
                        className="inline-block px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                      >
                        Change Password
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" /></div>}>
      <ProfilePageContent />
    </Suspense>
  );
}
