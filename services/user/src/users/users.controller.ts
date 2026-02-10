import { Controller, Get, Put, Delete, Body, UseGuards, Request, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateProfileDto, ChangePasswordDto } from './dto/update-profile.dto';
import { GatewayAuthGuard } from '@hos-marketplace/auth-common';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
@UseGuards(GatewayAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  async getProfile(@Request() req: any) {
    const user = await this.usersService.getProfile(req.user.id);
    return { data: user, message: 'Profile retrieved successfully' };
  }

  @Get('profile/gamification')
  async getGamificationStats(@Request() req: any) {
    const stats = await this.usersService.getGamificationStats(req.user.id);
    return { data: stats, message: 'Gamification stats retrieved' };
  }

  @Get('profile/badges')
  async getBadges(@Request() req: any) {
    const badges = await this.usersService.getUserBadges(req.user.id);
    return { data: badges, message: 'Badges retrieved' };
  }

  @Get('profile/collections')
  async getCollections(@Request() req: any) {
    const collections = await this.usersService.getUserCollections(req.user.id);
    return { data: collections, message: 'Collections retrieved' };
  }

  @Put('profile')
  async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    const user = await this.usersService.updateProfile(req.user.id, dto);
    return { data: user, message: 'Profile updated successfully' };
  }

  @Put('password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(req.user.id, dto);
    return { data: { message: 'Password changed' }, message: 'Password changed successfully' };
  }

  @Delete('account')
  @HttpCode(HttpStatus.OK)
  async deleteAccount(@Request() req: any) {
    await this.usersService.deleteAccount(req.user.id);
    return { data: { message: 'Account deleted' }, message: 'Account deleted successfully' };
  }
}
