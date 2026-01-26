import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';
import type { User } from '@hos-marketplace/shared-types';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Hard-protected admin accounts that must never be deleted via self-service endpoints.
  private readonly protectedAdminEmails = new Set([
    'app@houseofspells.co.uk',
    'mail@jsabu.com',
  ]);

  async getProfile(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        loyaltyPoints: true,
        themePreference: true,
        country: true,
        whatsappNumber: true,
        preferredCommunicationMethod: true,
        currencyPreference: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user as User;
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<User> {
    const updateData: any = {};

    if (updateProfileDto.firstName !== undefined) {
      updateData.firstName = updateProfileDto.firstName;
    }
    if (updateProfileDto.lastName !== undefined) {
      updateData.lastName = updateProfileDto.lastName;
    }
    if (updateProfileDto.phone !== undefined) {
      updateData.phone = updateProfileDto.phone;
    }
    if (updateProfileDto.avatar !== undefined) {
      updateData.avatar = updateProfileDto.avatar;
    }
    if (updateProfileDto.themePreference !== undefined) {
      updateData.themePreference = updateProfileDto.themePreference;
      
      // Update customer profile if exists
      const customer = await this.prisma.customer.findUnique({
        where: { userId },
      });
      
      if (customer) {
        await this.prisma.customer.update({
          where: { userId },
          data: { themePreference: updateProfileDto.themePreference },
        });
      }
    }

    // Global Platform Fields
    if (updateProfileDto.country !== undefined) {
      updateData.country = updateProfileDto.country;
    }
    if (updateProfileDto.whatsappNumber !== undefined) {
      updateData.whatsappNumber = updateProfileDto.whatsappNumber;
    }
    if (updateProfileDto.preferredCommunicationMethod !== undefined) {
      updateData.preferredCommunicationMethod = updateProfileDto.preferredCommunicationMethod;
    }
    if (updateProfileDto.currencyPreference !== undefined) {
      updateData.currencyPreference = updateProfileDto.currencyPreference;
      
      // Update customer profile if exists
      const customer = await this.prisma.customer.findUnique({
        where: { userId },
      });
      
      if (customer) {
        await this.prisma.customer.update({
          where: { userId },
          data: { currencyPreference: updateProfileDto.currencyPreference },
        });
      }
    }

    // Marketing dates
    if (updateProfileDto.birthday !== undefined) {
      updateData.birthday = updateProfileDto.birthday ? new Date(updateProfileDto.birthday) : null;
    }
    if (updateProfileDto.anniversary !== undefined) {
      updateData.anniversary = updateProfileDto.anniversary ? new Date(updateProfileDto.anniversary) : null;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        loyaltyPoints: true,
        themePreference: true,
        country: true,
        whatsappNumber: true,
        preferredCommunicationMethod: true,
        currencyPreference: true,
      },
    });

    return updated as User;
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, saltRounds);

    // Update password
    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async deleteAccount(userId: string): Promise<void> {
    // Check if user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (this.protectedAdminEmails.has(user.email)) {
      throw new BadRequestException('This account is protected and cannot be deleted');
    }

    // Delete user (cascading deletes will handle related records)
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  async getGamificationStats(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        characterAvatar: {
          select: {
            id: true,
            name: true,
            avatar: true,
            fandom: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Get badge count
    const badgeCount = await this.prisma.userBadge.count({
      where: { userId },
    });

    // Get quest stats
    const questStats = await this.prisma.userQuest.groupBy({
      by: ['status'],
      where: { userId },
      _count: true,
    });

    const completedQuests = questStats.find((q) => q.status === 'COMPLETED')?._count || 0;
    const activeQuests = questStats.find((q) => q.status === 'IN_PROGRESS')?._count || 0;

    // Calculate progress to next level (every 100 points = 1 level)
    const currentLevel = user.level || 1;
    const pointsForCurrentLevel = (currentLevel - 1) * 100;
    const pointsForNextLevel = currentLevel * 100;
    const pointsProgress = (user.gamificationPoints || 0) - pointsForCurrentLevel;
    const pointsNeeded = pointsForNextLevel - (user.gamificationPoints || 0);
    const progressPercentage = Math.min(
      100,
      (pointsProgress / (pointsForNextLevel - pointsForCurrentLevel)) * 100
    );

    return {
      points: user.gamificationPoints || 0,
      level: currentLevel,
      badgeCount,
      completedQuests,
      activeQuests,
      character: user.characterAvatar,
      favoriteFandoms: user.favoriteFandoms || [],
      progress: {
        current: pointsProgress,
        needed: pointsNeeded,
        percentage: progressPercentage,
        nextLevel: currentLevel + 1,
      },
    };
  }

  async getUserBadges(userId: string): Promise<any[]> {
    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
      include: {
        badge: true,
      },
      orderBy: {
        earnedAt: 'desc',
      },
    });

    return userBadges.map((ub) => ({
      id: ub.badge.id,
      name: ub.badge.name,
      description: ub.badge.description,
      icon: ub.badge.icon,
      category: ub.badge.category,
      rarity: ub.badge.rarity,
      points: ub.badge.points,
      earnedAt: ub.earnedAt,
    }));
  }

  async getUserCollections(userId: string): Promise<any[]> {
    const collections = await this.prisma.collection.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return collections.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      items: c.items,
      isPublic: c.isPublic,
      createdAt: c.createdAt,
      itemCount: Array.isArray(c.items) ? (c.items as any[]).length : 0,
    }));
  }
}
