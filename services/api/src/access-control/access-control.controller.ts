import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Query,
  Param,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AccessControlMe, ApiResponse } from '@hos-marketplace/shared-types';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccessControlService } from './access-control.service';
import { MarketService } from './market.service';
import { RequireAccess } from './decorators/require-access.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('access-control')
@ApiBearerAuth('JWT-auth')
@Controller('access-control')
export class AccessControlController {
  constructor(
    private readonly access: AccessControlService,
    private readonly markets: MarketService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Effective permissions, assignments, and visible markets' })
  async me(
    @CurrentUser() user: { id: string; role: string; homeMarketId?: string | null },
  ): Promise<ApiResponse<AccessControlMe>> {
    const data = await this.access.getMe(user);
    return { data, message: 'Access profile retrieved' };
  }

  @Get('catalog')
  @Roles('ADMIN')
  @RequireAccess({ permission: 'system.permissions', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Canonical permission catalog' })
  async catalog() {
    return { data: this.access.getCatalog(), message: 'Permission catalog' };
  }

  @Get('markets')
  @ApiOperation({ summary: 'Markets the caller may access' })
  async marketsForUser(
    @CurrentUser() user: { id: string; role: string; homeMarketId?: string | null },
  ) {
    const me = await this.access.getMe(user);
    return { data: me.markets, message: 'Markets retrieved' };
  }

  // ── Assignment CRUD ──────────────────────────────────────────────

  @Get('assignments')
  @Roles('ADMIN')
  @RequireAccess({ permission: 'users.roles', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'List role assignments for a user' })
  async listAssignments(@Query('userId') userId: string): Promise<ApiResponse<unknown>> {
    const data = await this.access.listAssignments(userId);
    return { data, message: 'Assignments retrieved' };
  }

  @Post('assignments')
  @Roles('ADMIN')
  @RequireAccess({ permission: 'users.roles', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Create a role assignment' })
  async createAssignment(
    @Body()
    body: {
      userId: string;
      permissionRoleId: string;
      scopeType: string;
      scopeId?: string;
    },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.access.createAssignment(body);
    return { data, message: 'Assignment created' };
  }

  @Delete('assignments/:id')
  @Roles('ADMIN')
  @RequireAccess({ permission: 'users.roles', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Delete a role assignment' })
  async deleteAssignment(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.access.deleteAssignment(id);
    return { data, message: 'Assignment deleted' };
  }

  // ── Permission Roles ─────────────────────────────────────────────

  @Get('roles')
  @Roles('ADMIN')
  @RequireAccess({ permission: 'system.permissions', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'List all permission roles' })
  async listRoles(): Promise<ApiResponse<unknown>> {
    const data = await this.access.listRoles();
    return { data, message: 'Permission roles retrieved' };
  }

  @Put('roles/:id')
  @Roles('ADMIN')
  @RequireAccess({ permission: 'system.permissions', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Update a permission role' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { permissions?: string[]; scopeKind?: string },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.access.updateRole(id, body);
    return { data, message: 'Permission role updated' };
  }

  // ── Admin Markets ────────────────────────────────────────────────

  @Get('admin/markets')
  @Roles('ADMIN')
  @RequireAccess({ permission: 'markets.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'List all markets (including inactive)' })
  async listAllMarkets(): Promise<ApiResponse<unknown>> {
    const data = await this.markets.listAll();
    return { data, message: 'All markets retrieved' };
  }

  @Post('admin/markets')
  @Roles('ADMIN')
  @RequireAccess({ permission: 'markets.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Create a new market' })
  async createMarket(
    @Body()
    body: {
      code: string;
      name: string;
      country: string;
      countryCode: string;
      currency: string;
      locale: string;
      timezone: string;
      isActive?: boolean;
      isDefault?: boolean;
    },
  ): Promise<ApiResponse<unknown>> {
    const data = await this.markets.create(body);
    return { data, message: 'Market created' };
  }

  @Put('admin/markets/:id')
  @Roles('ADMIN')
  @RequireAccess({ permission: 'markets.manage', scope: 'GLOBAL' })
  @ApiOperation({ summary: 'Update a market' })
  async updateMarket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    body: Partial<{
      name: string;
      country: string;
      countryCode: string;
      currency: string;
      locale: string;
      timezone: string;
      isActive: boolean;
      isDefault: boolean;
    }>,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.markets.update(id, body);
    return { data, message: 'Market updated' };
  }

  // ── Stores (scope picker) ───────────────────────────────────────

  @Get('stores')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List stores for scope assignment picker' })
  async listStores(): Promise<ApiResponse<unknown>> {
    const data = await this.access.listStores();
    return { data, message: 'Stores retrieved' };
  }
}
