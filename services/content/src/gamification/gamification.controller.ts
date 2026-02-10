import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, CurrentUser, AuthUser, Roles } from '@hos-marketplace/auth-common';
import { GamificationService } from './gamification.service';

@ApiTags('gamification')
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('badges') getBadges() { return this.gamificationService.getBadges(); }

  @Get('badges/me')
  @UseGuards(GatewayAuthGuard)
  getMyBadges(@CurrentUser() user: AuthUser) { return this.gamificationService.getUserBadges(user.id); }

  @Post('badges/:badgeId/award/:userId')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN')
  awardBadge(@Param('userId') userId: string, @Param('badgeId') badgeId: string) {
    return this.gamificationService.awardBadge(userId, badgeId);
  }

  @Get('quests') getQuests() { return this.gamificationService.getQuests(); }

  @Get('quests/me')
  @UseGuards(GatewayAuthGuard)
  getMyQuests(@CurrentUser() user: AuthUser) { return this.gamificationService.getUserQuests(user.id); }

  @Post('quests/:questId/start')
  @UseGuards(GatewayAuthGuard)
  startQuest(@CurrentUser() user: AuthUser, @Param('questId') questId: string) {
    return this.gamificationService.startQuest(user.id, questId);
  }

  @Post('quests/:questId/complete')
  @UseGuards(GatewayAuthGuard)
  completeQuest(@CurrentUser() user: AuthUser, @Param('questId') questId: string) {
    return this.gamificationService.completeQuest(user.id, questId);
  }
}
