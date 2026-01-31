import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatar?: string;
  points: number;
  level: number;
  badgeCount: number;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalParticipants: number;
  timeframe: string;
  category: string;
  userRank?: number;
}

@Injectable()
export class GamificationService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get leaderboard with rankings based on user points
   */
  async getLeaderboard(params: {
    timeframe?: string;
    category?: string;
    limit?: number;
    userId?: string;
  }): Promise<LeaderboardResponse> {
    const { timeframe = 'all-time', category = 'points', limit = 50, userId } = params;

    // Get users with their gamification stats ordered by loyalty points
    const users = await this.prisma.user.findMany({
      where: {
        role: { in: ['CUSTOMER', 'B2C_SELLER', 'SELLER'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        loyaltyPoints: true,
        createdAt: true,
      },
      orderBy: {
        loyaltyPoints: 'desc',
      },
      take: limit,
    });

    // Map to leaderboard entries
    const entries: LeaderboardEntry[] = users.map((user, index) => {
      const points = user.loyaltyPoints || 0;
      const level = Math.floor(points / 1000) + 1;

      return {
        rank: index + 1,
        userId: user.id,
        userName:
          `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0],
        avatar: user.avatar || undefined,
        points,
        level,
        badgeCount: 0,
      };
    });

    // Find current user's rank if provided
    let userRank: number | undefined;
    if (userId) {
      const userEntry = entries.find((e) => e.userId === userId);
      userRank = userEntry?.rank;

      // If user not in top entries, calculate their rank
      if (!userRank) {
        const userPoints = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { loyaltyPoints: true },
        });

        if (userPoints) {
          const higherRanked = await this.prisma.user.count({
            where: {
              loyaltyPoints: { gt: userPoints.loyaltyPoints || 0 },
            },
          });
          userRank = higherRanked + 1;
        }
      }
    }

    // Get total participants
    const totalParticipants = await this.prisma.user.count({
      where: {
        role: { in: ['CUSTOMER', 'B2C_SELLER', 'SELLER'] },
      },
    });

    return {
      entries,
      totalParticipants,
      timeframe,
      category,
      userRank,
    };
  }

  /**
   * Get user's gamification profile with stats
   */
  async getUserGamificationProfile(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        loyaltyPoints: true,
        createdAt: true,
      },
    });

    if (!user) {
      return null;
    }

    // Get order count
    const orderCount = await this.prisma.order.count({
      where: { userId },
    });

    // Get review count
    const reviewCount = await this.prisma.productReview.count({
      where: { userId },
    });

    // Get wishlist count
    const wishlistCount = await this.prisma.wishlistItem.count({
      where: { userId },
    });

    const points = user.loyaltyPoints || 0;
    const level = Math.floor(points / 1000) + 1;
    const pointsToNextLevel = 1000 - (points % 1000);

    // Calculate rank
    const higherRanked = await this.prisma.user.count({
      where: {
        loyaltyPoints: { gt: points },
      },
    });
    const rank = higherRanked + 1;

    return {
      userId: user.id,
      userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email.split('@')[0],
      avatar: user.avatar,
      points,
      level,
      pointsToNextLevel,
      rank,
      stats: {
        ordersPlaced: orderCount,
        reviewsWritten: reviewCount,
        wishlistItems: wishlistCount,
        memberSince: user.createdAt,
      },
      achievements: [],
      recentActivity: [],
    };
  }

  /**
   * Award points to a user
   */
  async awardPoints(userId: string, points: number, reason: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        loyaltyPoints: { increment: points },
      },
    });

    // Log the activity
    await this.prisma.activityLog.create({
      data: {
        user: { connect: { id: userId } },
        action: 'POINTS_AWARDED',
        entityType: 'User',
        entityId: userId,
        description: `Awarded ${points} points: ${reason}`,
        metadata: { points, reason },
      },
    });
  }
}
