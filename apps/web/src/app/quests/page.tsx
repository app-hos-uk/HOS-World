'use client';

import { useEffect, useState, useMemo } from 'react';
import { RouteGuard } from '@/components/RouteGuard';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import Link from 'next/link';

interface Quest {
  id: string;
  questId?: string;
  name: string;
  description?: string;
  type: string;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD' | 'EPIC';
  fandom?: {
    id: string;
    name: string;
    slug: string;
  };
  points: number;
  badge?: {
    id: string;
    name: string;
    icon?: string;
  };
  progress?: any;
  status?: string;
  startedAt?: string;
  completedAt?: string;
}

export default function QuestsPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'available' | 'active' | 'completed'>('available');
  const [availableQuests, setAvailableQuests] = useState<Quest[]>([]);
  const [activeQuests, setActiveQuests] = useState<Quest[]>([]);
  const [completedQuests, setCompletedQuests] = useState<Quest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [fandomFilter, setFandomFilter] = useState<string>('');

  useEffect(() => {
    fetchQuests();
  }, []);

  const fetchQuests = async () => {
    try {
      setLoading(true);
      const [availableRes, activeRes, completedRes] = await Promise.all([
        apiClient.getAvailableQuests(),
        apiClient.getActiveQuests(),
        apiClient.getCompletedQuests(),
      ]);

      if (availableRes?.data) setAvailableQuests(availableRes.data);
      if (activeRes?.data) setActiveQuests(activeRes.data);
      if (completedRes?.data) setCompletedQuests(completedRes.data);
    } catch (err: any) {
      console.error('Error fetching quests:', err);
      toast.error(err.message || 'Failed to load quests');
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuest = async (questId: string) => {
    try {
      setActionLoading(questId);
      await apiClient.startQuest(questId);
      toast.success('Quest started!');
      await fetchQuests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to start quest');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteQuest = async (questId: string) => {
    try {
      setActionLoading(questId);
      await apiClient.completeQuest(questId);
      toast.success('Quest completed! You earned points and badges!');
      await fetchQuests();
    } catch (err: any) {
      toast.error(err.message || 'Failed to complete quest');
    } finally {
      setActionLoading(null);
    }
  };

  // Calculate stats
  const stats = useMemo(() => {
    const totalPointsEarned = completedQuests.reduce((sum, q) => sum + (q.points || 0), 0);
    const badgesEarned = completedQuests.filter(q => q.badge).length;
    const uniqueFandoms = new Set([
      ...availableQuests.filter(q => q.fandom).map(q => q.fandom!.id),
      ...activeQuests.filter(q => q.fandom).map(q => q.fandom!.id),
      ...completedQuests.filter(q => q.fandom).map(q => q.fandom!.id),
    ]).size;
    
    return {
      totalPointsEarned,
      badgesEarned,
      questsCompleted: completedQuests.length,
      questsInProgress: activeQuests.length,
      uniqueFandoms,
    };
  }, [availableQuests, activeQuests, completedQuests]);

  // Get all unique fandoms
  const allFandoms = useMemo(() => {
    const fandoms = new Map<string, { id: string; name: string }>();
    [...availableQuests, ...activeQuests, ...completedQuests].forEach(q => {
      if (q.fandom) {
        fandoms.set(q.fandom.id, q.fandom);
      }
    });
    return Array.from(fandoms.values());
  }, [availableQuests, activeQuests, completedQuests]);

  // Filter quests by fandom
  const filterByFandom = (quests: Quest[]) => {
    if (!fandomFilter) return quests;
    return quests.filter(q => q.fandom?.id === fandomFilter);
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'EASY': return 'bg-green-100 text-green-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'HARD': return 'bg-orange-100 text-orange-800';
      case 'EPIC': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const renderQuestCard = (quest: Quest, showActions: boolean = true) => {
    const progress = quest.progress as any;
    const progressPercentage = progress?.percentage || 0;

    return (
      <div key={quest.id || quest.questId} className="bg-gray-50 rounded-lg p-6 hover:shadow-lg transition-shadow">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold">{quest.name}</h3>
              {quest.badge && (
                <span className="text-2xl">{quest.badge.icon || '🏆'}</span>
              )}
            </div>
            {quest.description && (
              <p className="text-sm text-gray-600 mb-3">{quest.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              {quest.fandom && (
                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                  {quest.fandom.name}
                </span>
              )}
              {quest.difficulty && (
                <span className={`px-2 py-1 rounded text-xs ${getDifficultyColor(quest.difficulty)}`}>
                  {quest.difficulty}
                </span>
              )}
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                ⭐ {quest.points} points
              </span>
              {quest.badge && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">
                  🏅 {quest.badge.name}
                </span>
              )}
            </div>
            {quest.status === 'IN_PROGRESS' && progressPercentage > 0 && (
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Progress</span>
                  <span>{progressPercentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full transition-all"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
              </div>
            )}
            {quest.completedAt && (
              <p className="text-xs text-gray-500">
                Completed: {new Date(quest.completedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        {showActions && (
          <div className="flex gap-2">
            {quest.status === 'IN_PROGRESS' ? (
              <button
                onClick={() => handleCompleteQuest(quest.questId || quest.id)}
                disabled={actionLoading === (quest.questId || quest.id)}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
              >
                {actionLoading === (quest.questId || quest.id) ? 'Completing...' : 'Complete Quest'}
              </button>
            ) : !quest.status ? (
              <button
                onClick={() => handleStartQuest(quest.id)}
                disabled={actionLoading === quest.id}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50"
              >
                {actionLoading === quest.id ? 'Starting...' : 'Start Quest'}
              </button>
            ) : null}
          </div>
        )}
      </div>
    );
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
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Quests</h1>
              <p className="text-gray-600 mt-1">Complete quests to earn points and unlock badges</p>
            </div>
            <Link
              href="/leaderboard"
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
            >
              🏆 View Leaderboard
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Points Earned</h3>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.totalPointsEarned.toLocaleString()}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Badges Earned</h3>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.badgesEarned}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Completed</h3>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.questsCompleted}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase">In Progress</h3>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.questsInProgress}</p>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-xs font-medium text-gray-500 uppercase">Fandoms</h3>
              <p className="text-2xl font-bold text-pink-600 mt-1">{stats.uniqueFandoms}</p>
            </div>
          </div>

          {/* Filter */}
          {allFandoms.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4 mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Filter by Fandom:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFandomFilter('')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                      fandomFilter === ''
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    All
                  </button>
                  {allFandoms.map(fandom => (
                    <button
                      key={fandom.id}
                      onClick={() => setFandomFilter(fandom.id)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        fandomFilter === fandom.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {fandom.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-6">
            <div className="flex flex-wrap border-b border-gray-200 bg-gray-50">
              <button
                onClick={() => setActiveTab('available')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'available'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Available ({availableQuests.length})
              </button>
              <button
                onClick={() => setActiveTab('active')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'active'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Active ({activeQuests.length})
              </button>
              <button
                onClick={() => setActiveTab('completed')}
                className={`px-6 py-3 font-medium transition-colors ${
                  activeTab === 'completed'
                    ? 'border-b-2 border-purple-600 text-purple-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Completed ({completedQuests.length})
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow p-6">
            {activeTab === 'available' && (
              <div>
                {filterByFandom(availableQuests).length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">🎯</div>
                    <p className="text-gray-600">
                      {fandomFilter ? 'No quests available for this fandom' : 'No available quests'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">Check back later for new quests!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filterByFandom(availableQuests).map((quest) => renderQuestCard(quest, true))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'active' && (
              <div>
                {filterByFandom(activeQuests).length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">⚡</div>
                    <p className="text-gray-600">
                      {fandomFilter ? 'No active quests for this fandom' : 'No active quests'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">Start a quest from the Available tab!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filterByFandom(activeQuests).map((quest) => renderQuestCard(quest, true))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'completed' && (
              <div>
                {filterByFandom(completedQuests).length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">✅</div>
                    <p className="text-gray-600">
                      {fandomFilter ? 'No completed quests for this fandom' : 'No completed quests yet'}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">Complete quests to earn points and badges!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {filterByFandom(completedQuests).map((quest) => renderQuestCard(quest, false))}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </RouteGuard>
  );
}
