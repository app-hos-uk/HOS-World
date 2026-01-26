import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { BadgesService } from './badges.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('badges')
@Controller('badges')
export class BadgesController {
  constructor(private readonly badgesService: BadgesService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all badges',
    description: 'Retrieves all active badges. Public endpoint.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Badges retrieved successfully' })
  async findAll(): Promise<ApiResponse<any[]>> {
    const badges = await this.badgesService.findAll();
    return {
      data: badges,
      message: 'Badges retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get badge by ID',
    description: 'Retrieves a specific badge. Public endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Badge ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Badge retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Badge not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const badge = await this.badgesService.findOne(id);
    return {
      data: badge,
      message: 'Badge retrieved successfully',
    };
  }

  @Get('my-badges')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get user badges',
    description: 'Retrieves all badges earned by the authenticated user.',
  })
  @SwaggerApiResponse({ status: 200, description: 'User badges retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getUserBadges(@Request() req: any): Promise<ApiResponse<any[]>> {
    const badges = await this.badgesService.getUserBadges(req.user.id);
    return {
      data: badges,
      message: 'User badges retrieved successfully',
    };
  }
}
