import { Controller, Get } from '@nestjs/common';
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
}
