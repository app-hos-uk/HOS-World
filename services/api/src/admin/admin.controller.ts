import {
  Controller,
  Get,
  Put,
  Delete,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Request,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateSellerDto } from './dto/create-seller.dto';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  async getDashboard(): Promise<ApiResponse<any>> {
    const data = await this.adminService.getDashboardStats();
    return {
      data,
      message: 'Dashboard data retrieved successfully',
    };
  }

  @Get('users')
  async getAllUsers(): Promise<ApiResponse<any[]>> {
    const users = await this.adminService.getAllUsers();
    return {
      data: users,
      message: 'Users retrieved successfully',
    };
  }

  @Get('users/:id')
  async getUserById(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const user = await this.adminService.getUserById(id);
    return {
      data: user,
      message: 'User retrieved successfully',
    };
  }

  @Put('users/:id')
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateData: {
      firstName?: string;
      lastName?: string;
      email?: string;
      role?: string;
      avatar?: string;
    },
  ): Promise<ApiResponse<any>> {
    const user = await this.adminService.updateUser(id, updateData);
    return {
      data: user,
      message: 'User updated successfully',
    };
  }

  @Delete('users/:id')
  async deleteUser(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<{ message: string }>> {
    await this.adminService.deleteUser(id);
    return {
      data: { message: 'User deleted successfully' },
      message: 'User deleted successfully',
    };
  }

  @Post('users/:id/reset-password')
  async resetUserPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { newPassword: string },
  ): Promise<ApiResponse<{ message: string }>> {
    await this.adminService.resetUserPassword(id, body.newPassword);
    return {
      data: { message: 'Password reset successfully' },
      message: 'Password reset successfully',
    };
  }

  @Get('settings')
  async getSettings(): Promise<ApiResponse<any>> {
    const settings = await this.adminService.getSystemSettings();
    return {
      data: settings,
      message: 'Settings retrieved successfully',
    };
  }

  @Put('settings')
  async updateSettings(@Body() settings: any): Promise<ApiResponse<any>> {
    const updated = await this.adminService.updateSystemSettings(settings);
    return {
      data: updated,
      message: 'Settings updated successfully',
    };
  }

  @Get('permissions/:role')
  async getRolePermissions(@Param('role') role: string): Promise<ApiResponse<string[]>> {
    const permissions = await this.adminService.getRolePermissions(role);
    return {
      data: permissions,
      message: 'Permissions retrieved successfully',
    };
  }

  @Put('permissions/:role')
  async updateRolePermissions(
    @Param('role') role: string,
    @Body() body: { permissions: string[] },
  ): Promise<ApiResponse<any>> {
    const updated = await this.adminService.updateRolePermissions(role, body.permissions);
    return {
      data: updated,
      message: 'Permissions updated successfully',
    };
  }

  @Get('sellers')
  async getAllSellers(): Promise<ApiResponse<any[]>> {
    const sellers = await this.adminService.getAllSellers();
    return {
      data: sellers,
      message: 'Sellers retrieved successfully',
    };
  }

  /**
   * Create a seller directly (for testing purposes)
   * Bypasses email invitation system
   * Seller will need to complete onboarding after login
   */
  @Post('sellers/create')
  async createSellerDirectly(
    @Body() createSellerDto: CreateSellerDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const result = await this.adminService.createSellerDirectly(createSellerDto);
    return {
      data: result,
      message: result.message,
    };
  }
}

