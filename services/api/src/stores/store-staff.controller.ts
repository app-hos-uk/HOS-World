import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { StoreCustomerSearchDto } from './dto/store-customer-search.dto';
import { StoreStaffGuard } from './guards/store-staff.guard';
import { StoreStaffCustomerService } from './store-staff-customer.service';
import { RequireAccess } from '../access-control/decorators/require-access.decorator';

@ApiTags('store-staff')
@ApiBearerAuth('JWT-auth')
@Controller('store')
@UseGuards(JwtAuthGuard, StoreStaffGuard)
export class StoreStaffController {
  constructor(private customers: StoreStaffCustomerService) {}

  @Post('customers/search')
  @RequireAccess({ permission: 'stores.operate', scope: 'STORE' })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({
    summary: 'Search loyalty members for store staff (masked results)',
  })
  async searchCustomers(
    @Body() dto: StoreCustomerSearchDto,
    @Req()
    req: {
      user: { id: string; role: string; storeId?: string | null };
      storeId?: string;
      ip?: string;
      headers: Record<string, string | string[] | undefined>;
    },
  ): Promise<ApiResponse<unknown>> {
    const storeId =
      req.user.role === 'STORE_STAFF'
        ? req.storeId || req.user.storeId
        : dto.storeId || req.storeId || req.user.storeId;

    if (!storeId) {
      throw new BadRequestException(
        'storeId is required (assign staff to a store, or pass storeId as admin)',
      );
    }

    const ua = req.headers['user-agent'];
    const data = await this.customers.search(dto, {
      staffUserId: req.user.id,
      storeId,
      ipAddress: req.ip,
      userAgent: Array.isArray(ua) ? ua[0] : ua,
    });
    return { data, message: 'OK' };
  }
}
