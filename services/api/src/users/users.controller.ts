import {
  Controller,
  Get,
  Put,
  Delete,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse, User } from '@hos-marketplace/shared-types';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get user profile', description: 'Retrieves the authenticated user\'s profile information' })
  @SwaggerApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Request() req: any): Promise<ApiResponse<User>> {
    const user = await this.usersService.getProfile(req.user.id);
    return {
      data: user,
      message: 'Profile retrieved successfully',
    };
  }

  @Get('profile/gamification')
  @ApiOperation({ summary: 'Get gamification stats', description: 'Retrieves the user\'s gamification statistics including points, level, and achievements' })
  @SwaggerApiResponse({ status: 200, description: 'Gamification stats retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getGamificationStats(@Request() req: any): Promise<ApiResponse<any>> {
    const stats = await this.usersService.getGamificationStats(req.user.id);
    return {
      data: stats,
      message: 'Gamification stats retrieved successfully',
    };
  }

  @Get('profile/badges')
  @ApiOperation({ summary: 'Get user badges', description: 'Retrieves all badges earned by the user' })
  @SwaggerApiResponse({ status: 200, description: 'Badges retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getBadges(@Request() req: any): Promise<ApiResponse<any[]>> {
    const badges = await this.usersService.getUserBadges(req.user.id);
    return {
      data: badges,
      message: 'Badges retrieved successfully',
    };
  }

  @Get('profile/collections')
  @ApiOperation({ summary: 'Get user collections', description: 'Retrieves all product collections created by the user' })
  @SwaggerApiResponse({ status: 200, description: 'Collections retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getCollections(@Request() req: any): Promise<ApiResponse<any[]>> {
    const collections = await this.usersService.getUserCollections(req.user.id);
    return {
      data: collections,
      message: 'Collections retrieved successfully',
    };
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update user profile', description: 'Updates the authenticated user\'s profile information' })
  @ApiBody({ type: UpdateProfileDto })
  @SwaggerApiResponse({ status: 200, description: 'Profile updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @Request() req: any,
    @Body() updateProfileDto: UpdateProfileDto,
  ): Promise<ApiResponse<User>> {
    const user = await this.usersService.updateProfile(req.user.id, updateProfileDto);
    return {
      data: user,
      message: 'Profile updated successfully',
    };
  }

  @Put('password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change password', description: 'Changes the authenticated user\'s password. Requires current password for verification' })
  @ApiBody({ type: ChangePasswordDto })
  @SwaggerApiResponse({ status: 200, description: 'Password changed successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid current password or weak new password' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @Request() req: any,
    @Body() changePasswordDto: ChangePasswordDto,
  ): Promise<ApiResponse<{ message: string }>> {
    await this.usersService.changePassword(req.user.id, changePasswordDto);
    return {
      data: { message: 'Password changed successfully' },
      message: 'Password changed successfully',
    };
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete account', description: 'Permanently deletes the authenticated user\'s account. This action cannot be undone' })
  @SwaggerApiResponse({ status: 200, description: 'Account deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAccount(@Request() req: any): Promise<ApiResponse<{ message: string }>> {
    await this.usersService.deleteAccount(req.user.id);
    return {
      data: { message: 'Account deleted successfully' },
      message: 'Account deleted successfully',
    };
  }
}
