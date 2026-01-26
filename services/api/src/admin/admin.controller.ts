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
  Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { CreateAdminUserDto } from './dto/create-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard', description: 'Retrieves admin dashboard statistics. Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getDashboard(): Promise<ApiResponse<any>> {
    const data = await this.adminService.getDashboardStats();
    return {
      data,
      message: 'Dashboard data retrieved successfully',
    };
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users', description: 'Retrieves all users in the system. Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getAllUsers(): Promise<ApiResponse<any[]>> {
    const users = await this.adminService.getAllUsers();
    return {
      data: users,
      message: 'Users retrieved successfully',
    };
  }

  @Post('users')
  @UseGuards(PermissionsGuard)
  @Permissions('users.create')
  @ApiOperation({ summary: 'Create admin user', description: 'Creates a new user with admin privileges. Requires users.create permission.' })
  @ApiBody({ type: CreateAdminUserDto })
  @SwaggerApiResponse({ status: 201, description: 'User created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid user data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access and users.create permission required' })
  async createUser(@Body() dto: CreateAdminUserDto): Promise<ApiResponse<any>> {
    const user = await this.adminService.createUser(dto);
    return {
      data: user,
      message: 'User created successfully',
    };
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user by ID', description: 'Retrieves a specific user by ID. Admin access required.' })
  @ApiParam({ name: 'id', description: 'User UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'User retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const user = await this.adminService.getUserById(id);
    return {
      data: user,
      message: 'User retrieved successfully',
    };
  }

  @Put('users/:id')
  @ApiOperation({ summary: 'Update user', description: 'Updates user information. Admin access required.' })
  @ApiParam({ name: 'id', description: 'User UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'First name (optional)' },
        lastName: { type: 'string', description: 'Last name (optional)' },
        email: { type: 'string', description: 'Email address (optional)' },
        role: { type: 'string', description: 'User role (optional)' },
        avatar: { type: 'string', description: 'Avatar URL (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'User updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'User not found' })
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
  @ApiOperation({ summary: 'Delete user', description: 'Deletes a user from the system. Admin access required.' })
  @ApiParam({ name: 'id', description: 'User UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'User deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'User not found' })
  async deleteUser(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<{ message: string }>> {
    await this.adminService.deleteUser(id);
    return {
      data: { message: 'User deleted successfully' },
      message: 'User deleted successfully',
    };
  }

  @Post('users/:id/reset-password')
  @ApiOperation({ summary: 'Reset user password', description: 'Resets a user\'s password. Admin access required.' })
  @ApiParam({ name: 'id', description: 'User UUID', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['newPassword'],
      properties: {
        newPassword: { type: 'string', description: 'New password' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Password reset successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid password' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  @SwaggerApiResponse({ status: 404, description: 'User not found' })
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
  @ApiOperation({ summary: 'Get system settings', description: 'Retrieves system-wide settings. Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Settings retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getSettings(): Promise<ApiResponse<any>> {
    const settings = await this.adminService.getSystemSettings();
    return {
      data: settings,
      message: 'Settings retrieved successfully',
    };
  }

  @Put('settings')
  @ApiOperation({ summary: 'Update system settings', description: 'Updates system-wide settings. Admin access required.' })
  @ApiBody({ description: 'Settings object' })
  @SwaggerApiResponse({ status: 200, description: 'Settings updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid settings data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async updateSettings(@Body() settings: any): Promise<ApiResponse<any>> {
    const updated = await this.adminService.updateSystemSettings(settings);
    return {
      data: updated,
      message: 'Settings updated successfully',
    };
  }

  // IMPORTANT: Specific routes must come before parameterized routes
  // Otherwise /permissions/catalog will match /permissions/:role with role="catalog"
  @Get('permissions/catalog')
  @UseGuards(PermissionsGuard)
  @Permissions('system.permissions')
  @ApiOperation({ summary: 'Get permission catalog', description: 'Retrieves the complete permission catalog. Requires system.permissions permission.' })
  @SwaggerApiResponse({ status: 200, description: 'Permission catalog retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access and system.permissions permission required' })
  async getPermissionCatalog(): Promise<ApiResponse<any>> {
    const catalog = await this.adminService.getPermissionCatalog();
    return { data: catalog, message: 'Permission catalog retrieved successfully' };
  }

  @Get('permissions/:role')
  @UseGuards(PermissionsGuard)
  @Permissions('system.permissions')
  @ApiOperation({ summary: 'Get role permissions', description: 'Retrieves permissions for a specific role. Requires system.permissions permission.' })
  @ApiParam({ name: 'role', description: 'Role name', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Permissions retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access and system.permissions permission required' })
  async getRolePermissions(@Param('role') role: string): Promise<ApiResponse<string[]>> {
    const permissions = await this.adminService.getRolePermissions(role);
    return {
      data: permissions,
      message: 'Permissions retrieved successfully',
    };
  }

  @Put('permissions/:role')
  @UseGuards(PermissionsGuard)
  @Permissions('system.permissions')
  @ApiOperation({ summary: 'Update role permissions', description: 'Updates permissions for a specific role. Requires system.permissions permission.' })
  @ApiParam({ name: 'role', description: 'Role name', type: String })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['permissions'],
      properties: {
        permissions: { type: 'array', items: { type: 'string' }, description: 'Array of permission strings' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Permissions updated successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid permissions data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access and system.permissions permission required' })
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

  @Get('roles')
  @UseGuards(PermissionsGuard)
  @Permissions('system.permissions')
  @ApiOperation({ summary: 'List all roles', description: 'Retrieves all available roles. Requires system.permissions permission.' })
  @SwaggerApiResponse({ status: 200, description: 'Roles retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access and system.permissions permission required' })
  async listRoles(): Promise<ApiResponse<string[]>> {
    const roles = await this.adminService.listPermissionRoles();
    return { data: roles, message: 'Roles retrieved successfully' };
  }

  @Post('roles')
  @UseGuards(PermissionsGuard)
  @Permissions('system.permissions')
  @ApiOperation({ summary: 'Create role', description: 'Creates a new role. Requires system.permissions permission.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', description: 'Role name' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Role created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid role data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access and system.permissions permission required' })
  async createRole(@Body() body: { name: string }): Promise<ApiResponse<any>> {
    const created = await this.adminService.createPermissionRole(body.name);
    return { data: created, message: 'Role created successfully' };
  }

  @Get('sellers')
  @ApiOperation({ summary: 'Get all sellers', description: 'Retrieves all sellers in the system. Admin access required.' })
  @SwaggerApiResponse({ status: 200, description: 'Sellers retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin access required' })
  async getAllSellers(): Promise<ApiResponse<any[]>> {
    const sellers = await this.adminService.getAllSellers();
    return {
      data: sellers,
      message: 'Sellers retrieved successfully',
    };
  }
}

