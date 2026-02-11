import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { EventBusService, USER_EVENTS } from '@hos-marketplace/events';
import { UserPrismaService } from '../database/prisma.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly protectedAdminEmails = new Set(['app@houseofspells.co.uk', 'mail@jsabu.com']);

  constructor(
    private prisma: UserPrismaService,
    private eventBus: EventBusService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        role: true, avatar: true, createdAt: true, updatedAt: true,
        loyaltyPoints: true, themePreference: true, country: true,
        whatsappNumber: true, preferredCommunicationMethod: true, currencyPreference: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const updateData: any = {};
    if (dto.firstName !== undefined) updateData.firstName = dto.firstName;
    if (dto.lastName !== undefined) updateData.lastName = dto.lastName;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.avatar !== undefined) updateData.avatar = dto.avatar;
    if (dto.themePreference !== undefined) updateData.themePreference = dto.themePreference;
    if (dto.country !== undefined) updateData.country = dto.country;
    if (dto.whatsappNumber !== undefined) updateData.whatsappNumber = dto.whatsappNumber;
    if (dto.preferredCommunicationMethod !== undefined) updateData.preferredCommunicationMethod = dto.preferredCommunicationMethod;
    if (dto.currencyPreference !== undefined) updateData.currencyPreference = dto.currencyPreference;
    if (dto.birthday !== undefined) updateData.birthday = dto.birthday ? new Date(dto.birthday) : null;
    if (dto.anniversary !== undefined) updateData.anniversary = dto.anniversary ? new Date(dto.anniversary) : null;

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true, email: true, firstName: true, lastName: true, phone: true,
        role: true, avatar: true, createdAt: true, updatedAt: true,
        loyaltyPoints: true, themePreference: true, country: true,
        whatsappNumber: true, preferredCommunicationMethod: true, currencyPreference: true,
      },
    });

    // Emit user.user.updated event
    try {
      this.eventBus.emit(USER_EVENTS.UPDATED, {
        userId,
        changes: updateData,
      });
    } catch (e: any) {
      this.logger.warn(`Failed to emit user.updated event: ${e?.message}`);
    }

    return updated;
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { password: true } });
    if (!user) throw new NotFoundException('User not found');
    const isValid = await bcrypt.compare(dto.currentPassword, user.password!);
    if (!isValid) throw new BadRequestException('Current password is incorrect');
    const hashed = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  }

  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (this.protectedAdminEmails.has(user.email)) throw new BadRequestException('This account is protected');
    await this.prisma.user.delete({ where: { id: userId } });
  }

  async getGamificationStats(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const badgeCount = await this.prisma.userBadge.count({ where: { userId } });
    const questStats = await this.prisma.userQuest.groupBy({ by: ['status'], where: { userId }, _count: true });
    const completedQuests = questStats.find((q) => q.status === 'COMPLETED')?._count || 0;
    const activeQuests = questStats.find((q) => q.status === 'IN_PROGRESS')?._count || 0;

    const currentLevel = user.level || 1;
    const pointsForCurrentLevel = (currentLevel - 1) * 100;
    const pointsForNextLevel = currentLevel * 100;
    const pointsProgress = (user.gamificationPoints || 0) - pointsForCurrentLevel;
    const pointsNeeded = pointsForNextLevel - (user.gamificationPoints || 0);
    const progressPercentage = Math.min(100, (pointsProgress / (pointsForNextLevel - pointsForCurrentLevel)) * 100);

    return {
      points: user.gamificationPoints || 0, level: currentLevel, badgeCount, completedQuests, activeQuests,
      favoriteFandoms: user.favoriteFandoms || [],
      progress: { current: pointsProgress, needed: pointsNeeded, percentage: progressPercentage, nextLevel: currentLevel + 1 },
    };
  }

  async getUserBadges(userId: string) {
    return this.prisma.userBadge.findMany({
      where: { userId }, include: { badge: true }, orderBy: { earnedAt: 'desc' },
    });
  }

  async getUserCollections(userId: string) {
    return this.prisma.collection.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }
}
