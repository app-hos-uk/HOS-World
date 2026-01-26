import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { QuestsService } from './quests.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('quests')
@Version('1')
@Controller('quests')
export class QuestsController {
  constructor(private readonly questsService: QuestsService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Get all quests',
    description: 'Retrieves all active quests. Public endpoint.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Quests retrieved successfully' })
  async findAll(): Promise<ApiResponse<any[]>> {
    const quests = await this.questsService.findAll();
    return {
      data: quests,
      message: 'Quests retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  @ApiOperation({
    summary: 'Get quest by ID',
    description: 'Retrieves a specific quest. Public endpoint.',
  })
  @ApiParam({ name: 'id', description: 'Quest ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Quest retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Quest not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const quest = await this.questsService.findOne(id);
    return {
      data: quest,
      message: 'Quest retrieved successfully',
    };
  }

  @Get('available')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get available quests',
    description: 'Retrieves quests that the user has not started yet.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Available quests retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getAvailableQuests(@Request() req: any): Promise<ApiResponse<any[]>> {
    const quests = await this.questsService.getAvailableQuests(req.user.id);
    return {
      data: quests,
      message: 'Available quests retrieved successfully',
    };
  }

  @Get('active')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get active quests',
    description: 'Retrieves quests that the user has started but not completed.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Active quests retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getActiveQuests(@Request() req: any): Promise<ApiResponse<any[]>> {
    const quests = await this.questsService.getActiveQuests(req.user.id);
    return {
      data: quests,
      message: 'Active quests retrieved successfully',
    };
  }

  @Get('completed')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Get completed quests',
    description: 'Retrieves quests that the user has completed.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Completed quests retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getCompletedQuests(@Request() req: any): Promise<ApiResponse<any[]>> {
    const quests = await this.questsService.getCompletedQuests(req.user.id);
    return {
      data: quests,
      message: 'Completed quests retrieved successfully',
    };
  }

  @Post(':id/start')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Start quest',
    description: 'Starts a quest for the authenticated user.',
  })
  @ApiParam({ name: 'id', description: 'Quest ID', type: String })
  @SwaggerApiResponse({ status: 201, description: 'Quest started successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Quest already started or not active' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Quest not found' })
  async startQuest(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const quest = await this.questsService.startQuest(req.user.id, id);
    return {
      data: quest,
      message: 'Quest started successfully',
    };
  }

  @Post(':id/complete')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Complete quest',
    description: 'Completes a quest for the authenticated user. Awards points and badges.',
  })
  @ApiParam({ name: 'id', description: 'Quest ID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Quest completed successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Quest not started or already completed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Quest not found' })
  async completeQuest(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const quest = await this.questsService.completeQuest(req.user.id, id);
    return {
      data: quest,
      message: 'Quest completed successfully',
    };
  }
}
