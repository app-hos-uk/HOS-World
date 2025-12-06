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
import { UsersService } from './users.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { ApiResponse, User } from '@hos-marketplace/shared-types';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Request() req: any): Promise<ApiResponse<User>> {
    const user = await this.usersService.getProfile(req.user.id);
    return {
      data: user,
      message: 'Profile retrieved successfully',
    };
  }

  @Get('profile/gamification')
  async getGamificationStats(@Request() req: any): Promise<ApiResponse<any>> {
    const stats = await this.usersService.getGamificationStats(req.user.id);
    return {
      data: stats,
      message: 'Gamification stats retrieved successfully',
    };
  }

  @Get('profile/badges')
  async getBadges(@Request() req: any): Promise<ApiResponse<any[]>> {
    const badges = await this.usersService.getUserBadges(req.user.id);
    return {
      data: badges,
      message: 'Badges retrieved successfully',
    };
  }

  @Get('profile/collections')
  async getCollections(@Request() req: any): Promise<ApiResponse<any[]>> {
    const collections = await this.usersService.getUserCollections(req.user.id);
    return {
      data: collections,
      message: 'Collections retrieved successfully',
    };
  }

  @Put('profile')
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
  async deleteAccount(@Request() req: any): Promise<ApiResponse<{ message: string }>> {
    await this.usersService.deleteAccount(req.user.id);
    return {
      data: { message: 'Account deleted successfully' },
      message: 'Account deleted successfully',
    };
  }
}
