import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { LoyaltyService } from './loyalty.service';
import { LookupMemberDto } from './dto/lookup-member.dto';
import { LoyaltyStaffAuthGuard } from './guards/loyalty-staff-auth.guard';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('loyalty')
@Controller('loyalty')
export class LoyaltyPosController {
  constructor(private loyalty: LoyaltyService) {}

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
}
