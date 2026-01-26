import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('tenants')
@ApiBearerAuth('JWT-auth')
@Version('1')
@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Create a new tenant' })
  @ApiBody({ type: CreateTenantDto })
  @SwaggerApiResponse({ status: 201, description: 'Tenant created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request or domain/subdomain already in use' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Body() createDto: CreateTenantDto): Promise<ApiResponse<any>> {
    const tenant = await this.tenantsService.create(createDto);
    return {
      data: tenant,
      message: 'Tenant created successfully',
    };
  }

  @Get()
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Get all tenants' })
  @SwaggerApiResponse({ status: 200, description: 'Tenants retrieved successfully' })
  async findAll(): Promise<ApiResponse<any[]>> {
    const tenants = await this.tenantsService.findAll();
    return {
      data: tenants,
      message: 'Tenants retrieved successfully',
    };
  }

  @Get('my-tenants')
  @ApiOperation({ summary: 'Get current user tenants' })
  @SwaggerApiResponse({ status: 200, description: 'User tenants retrieved successfully' })
  async getMyTenants(@Request() req: any): Promise<ApiResponse<any[]>> {
    const tenants = await this.tenantsService.getUserTenants(req.user.id);
    return {
      data: tenants,
      message: 'User tenants retrieved successfully',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get tenant by ID' })
  @SwaggerApiResponse({ status: 200, description: 'Tenant retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Tenant not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const tenant = await this.tenantsService.findOne(id);
    return {
      data: tenant,
      message: 'Tenant retrieved successfully',
    };
  }

  @Put(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update tenant' })
  @ApiBody({ type: UpdateTenantDto })
  @SwaggerApiResponse({ status: 200, description: 'Tenant updated successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Tenant not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateTenantDto,
  ): Promise<ApiResponse<any>> {
    const tenant = await this.tenantsService.update(id, updateDto);
    return {
      data: tenant,
      message: 'Tenant updated successfully',
    };
  }

  @Post(':id/users/:userId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add user to tenant' })
  @ApiBody({ schema: { type: 'object', properties: { role: { type: 'string' } } } })
  @SwaggerApiResponse({ status: 201, description: 'User added to tenant successfully' })
  @SwaggerApiResponse({ status: 400, description: 'User already belongs to tenant' })
  @SwaggerApiResponse({ status: 404, description: 'Tenant or user not found' })
  async addUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body('role') role: string,
  ): Promise<ApiResponse<any>> {
    const membership = await this.tenantsService.addUser(id, userId, role);
    return {
      data: membership,
      message: 'User added to tenant successfully',
    };
  }

  @Put(':id/users/:userId/role')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Update user role in tenant' })
  @ApiBody({ schema: { type: 'object', properties: { role: { type: 'string' } } } })
  @SwaggerApiResponse({ status: 200, description: 'User role updated successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Tenant membership not found' })
  async updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body('role') role: string,
  ): Promise<ApiResponse<any>> {
    const membership = await this.tenantsService.updateUserRole(id, userId, role);
    return {
      data: membership,
      message: 'User role updated successfully',
    };
  }

  @Delete(':id/users/:userId')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove user from tenant' })
  @SwaggerApiResponse({ status: 200, description: 'User removed from tenant successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Tenant membership not found' })
  async removeUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.tenantsService.removeUser(id, userId);
    return {
      data: result,
      message: 'User removed from tenant successfully',
    };
  }
}
