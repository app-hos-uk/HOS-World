import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { GamificationService, LeaderboardResponse } from './gamification.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('gamification')
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Public()
  @Get('leaderboard')
  @ApiOperation({
    summary: 'Get gamification leaderboard',
    description: 'Retrieves the leaderboard rankings. Public endpoint with optional authentication for user rank.',
  })
  @ApiQuery({ name: 'timeframe', required: false, enum: ['daily', 'weekly', 'monthly', 'yearly', 'all-time'], description: 'Time period for rankings' })
  @ApiQuery({ name: 'category', required: false, enum: ['points', 'engagement', 'purchases'], description: 'Category to rank by' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Number of entries to return (max 100)' })
  @SwaggerApiResponse({ status: 200, description: 'Leaderboard retrieved successfully' })
  async getLeaderboard(
    @Query('timeframe') timeframe?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
    @Request() req?: any,
  ): Promise<ApiResponse<LeaderboardResponse>> {
    const userId = req?.user?.id;
    const parsedLimit = Math.min(parseInt(limit || '50', 10), 100);

    const leaderboard = await this.gamificationService.getLeaderboard({
      timeframe: timeframe || 'all-time',
      category: category || 'points',
      limit: parsedLimit,
      userId,
    });

    return {
      data: leaderboard,
      message: 'Leaderboard retrieved successfully',
    };
  }

  @Get('profile')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get user gamification profile',
    description: 'Retrieves the authenticated user\'s gamification stats including points, level, and rank.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Gamification profile retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getGamificationProfile(@Request() req: any): Promise<ApiResponse<any>> {
    const profile = await this.gamificationService.getUserGamificationProfile(req.user.id);
    return {
      data: profile,
      message: 'Gamification profile retrieved successfully',
    };
  }

  @Get('stats')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get user gamification stats',
    description: 'Retrieves quick stats for the authenticated user.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Stats retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getStats(@Request() req: any): Promise<ApiResponse<any>> {
    const profile = await this.gamificationService.getUserGamificationProfile(req.user.id);
    return {
      data: {
        points: profile?.points || 0,
        level: profile?.level || 1,
        rank: profile?.rank || 0,
        pointsToNextLevel: profile?.pointsToNextLevel || 1000,
      },
      message: 'Stats retrieved successfully',
    };
  }
}
