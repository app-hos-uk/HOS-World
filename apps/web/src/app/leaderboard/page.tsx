'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

interface LeaderboardEntry {
  id: string;
  rank: number;
  userId: string;
  username?: string;
  displayName?: string;
  avatar?: string;
  points: number;
  level: number;
  badges: number;
  questsCompleted: number;
  isCurrentUser?: boolean;
}

interface LeaderboardStats {
  totalPlayers: number;
  currentUserRank?: number;
  currentUserPoints?: number;
  topPlayerPoints?: number;
}

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<LeaderboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'all' | 'monthly' | 'weekly'>('all');
  const [category, setCategory] = useState<'points' | 'quests' | 'badges'>('points');

  useEffect(() => {
    fetchLeaderboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe, category]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      // Fetch gamification data
      const [leaderboardResponse, profileResponse] = await Promise.all([
        apiClient.getLeaderboard(),
        apiClient.getGamificationProfile().catch(() => null),
      ]);

      let entries: LeaderboardEntry[] = [];
      let currentUserId = profileResponse?.data?.userId;

      if (leaderboardResponse?.data) {
        const data = Array.isArray(leaderboardResponse.data) 
          ? leaderboardResponse.data 
          : leaderboardResponse.data.entries || [];

        entries = data.map((entry: any, index: number) => ({
          id: entry.id || entry.userId || `entry-${index}`,
          rank: entry.rank || index + 1,
          userId: entry.userId,
          username: entry.username || entry.user?.username || `Player ${index + 1}`,
          displayName: entry.displayName || entry.user?.displayName,
          avatar: entry.avatar || entry.user?.avatar,
          points: entry.points || entry.totalPoints || 0,
          level: entry.level || Math.floor((entry.points || 0) / 1000) + 1,
          badges: entry.badges || entry.badgeCount || 0,
          questsCompleted: entry.questsCompleted || entry.completedQuests || 0,
          isCurrentUser: entry.userId === currentUserId,
        }));

        // Sort based on category
        if (category === 'points') {
          entries.sort((a, b) => b.points - a.points);
        } else if (category === 'quests') {
          entries.sort((a, b) => b.questsCompleted - a.questsCompleted);
        } else if (category === 'badges') {
          entries.sort((a, b) => b.badges - a.badges);
        }

        // Update ranks after sorting
        entries = entries.map((entry, index) => ({ ...entry, rank: index + 1 }));
      }

      // Calculate stats
      const currentUserEntry = entries.find(e => e.isCurrentUser);
      setStats({
        totalPlayers: entries.length,
        currentUserRank: currentUserEntry?.rank,
        currentUserPoints: currentUserEntry?.points,
        topPlayerPoints: entries[0]?.points || 0,
      });

      setLeaderboard(entries);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      // Generate sample data for demo
      const sampleData: LeaderboardEntry[] = [
        { id: '1', rank: 1, userId: '1', username: 'DragonMaster', points: 15420, level: 16, badges: 24, questsCompleted: 48 },
        { id: '2', rank: 2, userId: '2', username: 'StarCollector', points: 12850, level: 13, badges: 19, questsCompleted: 42 },
        { id: '3', rank: 3, userId: '3', username: 'FandomHero', points: 11200, level: 12, badges: 17, questsCompleted: 38 },
        { id: '4', rank: 4, userId: '4', username: 'QuestRunner', points: 9800, level: 10, badges: 15, questsCompleted: 35 },
        { id: '5', rank: 5, userId: '5', username: 'BadgeHunter', points: 8450, level: 9, badges: 13, questsCompleted: 30 },
        { id: '6', rank: 6, userId: '6', username: 'PointsKing', points: 7200, level: 8, badges: 11, questsCompleted: 26 },
        { id: '7', rank: 7, userId: '7', username: 'CollectorPro', points: 6100, level: 7, badges: 10, questsCompleted: 22 },
        { id: '8', rank: 8, userId: '8', username: 'TreasureFinder', points: 5400, level: 6, badges: 8, questsCompleted: 19 },
        { id: '9', rank: 9, userId: '9', username: 'AdventureSeeker', points: 4800, level: 5, badges: 7, questsCompleted: 16 },
        { id: '10', rank: 10, userId: '10', username: 'NewExplorer', points: 3200, level: 4, badges: 5, questsCompleted: 12 },
      ];
      setLeaderboard(sampleData);
      setStats({
        totalPlayers: sampleData.length,
        topPlayerPoints: sampleData[0].points,
      });
    } finally {
      setLoading(false);
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1: return { emoji: '🥇', bg: 'bg-gradient-to-r from-yellow-400 to-yellow-600', text: 'text-white' };
      case 2: return { emoji: '🥈', bg: 'bg-gradient-to-r from-gray-300 to-gray-400', text: 'text-gray-800' };
      case 3: return { emoji: '🥉', bg: 'bg-gradient-to-r from-orange-400 to-orange-600', text: 'text-white' };
      default: return { emoji: '', bg: 'bg-gray-100', text: 'text-gray-700' };
    }
  };

  const getCategoryValue = (entry: LeaderboardEntry) => {
    switch (category) {
      case 'points': return entry.points.toLocaleString();
      case 'quests': return entry.questsCompleted;
      case 'badges': return entry.badges;
    }
  };

  const getCategoryLabel = () => {
    switch (category) {
      case 'points': return 'Points';
      case 'quests': return 'Quests';
      case 'badges': return 'Badges';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-900 via-purple-800 to-gray-900">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            🏆 Leaderboard
          </h1>
          <p className="text-purple-200 text-lg max-w-2xl mx-auto">
            Compete with fellow collectors and climb the ranks! Earn points by completing quests, 
            collecting badges, and exploring the marketplace.
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 max-w-4xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <p className="text-purple-200 text-sm">Total Players</p>
              <p className="text-3xl font-bold text-white">{stats.totalPlayers}</p>
            </div>
            {stats.currentUserRank && (
              <div className="bg-purple-500/20 backdrop-blur-sm rounded-lg p-4 text-center border-2 border-purple-400">
                <p className="text-purple-200 text-sm">Your Rank</p>
                <p className="text-3xl font-bold text-white">#{stats.currentUserRank}</p>
              </div>
            )}
            {stats.currentUserPoints !== undefined && (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
              <p className="text-purple-200 text-sm">Your Points</p>
               <p className="text-3xl font-bold text-white">{(stats.currentUserPoints ?? 0).toLocaleString()}</p>
             </div>
           )}
           <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center">
             <p className="text-purple-200 text-sm">Top Score</p>
             <p className="text-3xl font-bold text-yellow-400">{(stats.topPlayerPoints ?? 0).toLocaleString()}</p>
           </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
          {/* Timeframe Filter */}
          <div className="flex rounded-lg bg-white/10 p-1">
            {(['all', 'monthly', 'weekly'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  timeframe === t
                    ? 'bg-purple-600 text-white'
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                {t === 'all' ? 'All Time' : t === 'monthly' ? 'This Month' : 'This Week'}
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="flex rounded-lg bg-white/10 p-1">
            {(['points', 'quests', 'badges'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                  category === c
                    ? 'bg-purple-600 text-white'
                    : 'text-purple-200 hover:text-white'
                }`}
              >
                {c === 'points' ? '⭐ Points' : c === 'quests' ? '🎯 Quests' : '🏅 Badges'}
              </button>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            {/* Top 3 Podium */}
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[1, 0, 2].map((podiumIndex) => {
                const entry = leaderboard[podiumIndex];
                if (!entry) return <div key={podiumIndex} className="hidden sm:block" />;

                const rankBadge = getRankBadge(entry.rank);
                const heightClass = entry.rank === 1 ? 'h-32' : entry.rank === 2 ? 'h-24' : 'h-20';

                return (
                  <div 
                    key={entry.id} 
                    className={`flex flex-col items-center ${entry.rank === 1 ? 'order-2' : entry.rank === 2 ? 'order-1' : 'order-3'}`}
                  >
                    <div className={`relative mb-4 ${entry.isCurrentUser ? 'ring-4 ring-purple-400 rounded-full' : ''}`}>
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
                        {entry.avatar ? (
                          <img src={entry.avatar} alt={entry.username} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          entry.username?.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-2xl">
                        {rankBadge.emoji}
                      </div>
                    </div>
                    <p className="text-white font-bold text-center text-sm sm:text-base">{entry.displayName || entry.username}</p>
                    <p className="text-purple-200 text-sm">{getCategoryValue(entry)} {getCategoryLabel()}</p>
                    <div className={`${rankBadge.bg} ${heightClass} w-full max-w-[100px] rounded-t-lg mt-2`} />
                  </div>
                );
              })}
            </div>

            {/* Full Leaderboard */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">Full Rankings</h2>
              </div>
              <div className="divide-y divide-white/10">
                {leaderboard.map((entry) => {
                  const rankBadge = getRankBadge(entry.rank);
                  return (
                    <div
                      key={entry.id}
                      className={`px-6 py-4 flex items-center gap-4 transition-colors ${
                        entry.isCurrentUser 
                          ? 'bg-purple-500/20 border-l-4 border-purple-400' 
                          : 'hover:bg-white/5'
                      }`}
                    >
                      {/* Rank */}
                      <div className={`w-10 h-10 rounded-full ${rankBadge.bg} flex items-center justify-center ${rankBadge.text} font-bold`}>
                        {entry.rank <= 3 ? rankBadge.emoji : entry.rank}
                      </div>

                      {/* Avatar & Name */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0">
                          {entry.avatar ? (
                            <img src={entry.avatar} alt={entry.username} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            entry.username?.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-medium truncate">
                            {entry.displayName || entry.username}
                            {entry.isCurrentUser && <span className="ml-2 text-purple-300 text-sm">(You)</span>}
                          </p>
                          <p className="text-purple-300 text-sm">Level {entry.level}</p>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="hidden sm:flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <p className="text-purple-300">Quests</p>
                          <p className="text-white font-semibold">{entry.questsCompleted}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-purple-300">Badges</p>
                          <p className="text-white font-semibold">{entry.badges}</p>
                        </div>
                      </div>

                      {/* Points */}
                      <div className="text-right">
                        <p className="text-yellow-400 font-bold text-lg">{getCategoryValue(entry)}</p>
                        <p className="text-purple-300 text-xs">{getCategoryLabel()}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Call to Action */}
            <div className="mt-8 text-center">
              <p className="text-purple-200 mb-4">Ready to climb the ranks?</p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link
                  href="/quests"
                  className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                >
                  🎯 Complete Quests
                </Link>
                <Link
                  href="/profile"
                  className="px-6 py-3 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors font-medium border border-white/20"
                >
                  👤 View Profile
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
