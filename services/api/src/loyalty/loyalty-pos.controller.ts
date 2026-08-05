import { Body, Controller, Headers, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { LoyaltyService } from './loyalty.service';
import { PosVoucherService } from './services/pos-voucher.service';
import { LookupMemberDto } from './dto/lookup-member.dto';
import { StaffEnrollDto } from './dto/staff-enroll.dto';
import { RedeemForVoucherDto } from './dto/redeem-for-voucher.dto';
import { LoyaltyStaffAuthGuard } from './guards/loyalty-staff-auth.guard';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('loyalty')
@Controller('loyalty')
export class LoyaltyPosController {
  constructor(
    private loyalty: LoyaltyService,
    private posVouchers: PosVoucherService,
  ) {}

  @Public()
  @Post('lookup')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiOperation({ summary: 'Lookup member by email, phone, or card (API key or admin JWT)' })
  @ApiHeader({ name: 'x-api-key', required: false })
  @ApiBearerAuth('JWT-auth')
  async lookup(@Body() body: LookupMemberDto): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.lookupMember(body);
    return { data, message: 'OK' };
  }

  @Public()
  @Post('pos/enroll')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiOperation({
    summary:
      'In-store staff enrolment (requires email; API key or admin JWT). Path is pos/enroll to avoid colliding with customer POST /loyalty/enroll.',
  })
  @ApiHeader({ name: 'x-api-key', required: false })
  @ApiBearerAuth('JWT-auth')
  async enroll(@Body() body: StaffEnrollDto): Promise<ApiResponse<unknown>> {
    const data = await this.loyalty.enrollFromPos(body);
    return { data, message: 'Enrolled' };
  }

  @Public()
  @Post('pos/redeem-for-voucher')
  @UseGuards(LoyaltyStaffAuthGuard)
  @ApiOperation({
    summary:
      'Burn loyalty points at a HOS outlet and issue a Lightspeed gift card voucher for till payment. Requires an idempotency key (body or Idempotency-Key header) for new redemptions; pass voucherId to retry a FAILED issuance (same clientId).',
  })
  @ApiHeader({ name: 'x-api-key', required: false })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Terminal replay key; alternative to body.idempotencyKey',
  })
  @ApiBearerAuth('JWT-auth')
  async redeemForVoucher(
    @Body() body: RedeemForVoucherDto,
    @Headers('idempotency-key') idempotencyKeyHeader?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.posVouchers.redeemForVoucher({
      ...body,
      idempotencyKey: body.idempotencyKey?.trim() || idempotencyKeyHeader?.trim() || undefined,
    });
    return { data, message: 'Voucher issued' };
  }
}
