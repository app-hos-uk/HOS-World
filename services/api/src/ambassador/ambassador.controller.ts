import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { AmbassadorService } from './ambassador.service';
import { EnrollAmbassadorDto } from './dto/enroll-ambassador.dto';
import { UpdateAmbassadorDto } from './dto/update-ambassador.dto';
import { SubmitUgcDto } from './dto/submit-ugc.dto';

@ApiTags('loyalty-ambassador')
@ApiBearerAuth('JWT-auth')
@Controller('loyalty/ambassador')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CUSTOMER')
export class AmbassadorController {
  constructor(private ambassador: AmbassadorService) {}

  @Get('eligibility')
  @ApiOperation({ summary: 'Ambassador programme eligibility' })
  async eligibility(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.eligibility(req.user.id);
    return { data, message: 'OK' };
  }

  @Post('enroll')
  @ApiOperation({ summary: 'Enroll as ambassador' })
  async enroll(
    @Request() req: { user: { id: string } },
    @Body() dto: EnrollAmbassadorDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.enroll(req.user.id, dto);
    return { data, message: 'Welcome, ambassador' };
  }

  @Get('profile')
  @ApiOperation({ summary: 'Ambassador profile' })
  async profile(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.getProfile(req.user.id);
    return { data, message: 'OK' };
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update ambassador profile' })
  async patchProfile(
    @Request() req: { user: { id: string } },
    @Body() dto: UpdateAmbassadorDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.updateProfile(req.user.id, dto);
    return { data, message: 'Updated' };
  }

  @Post('ugc')
  @ApiOperation({ summary: 'Submit UGC' })
  async submitUgc(
    @Request() req: { user: { id: string } },
    @Body() dto: SubmitUgcDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.submitUgc(req.user.id, dto);
    return { data, message: 'Submitted' };
  }

  @Get('ugc')
  @ApiOperation({ summary: 'List my UGC submissions' })
  async listUgc(
    @Request() req: { user: { id: string } },
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.listOwnUgc(req.user.id, {
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    return { data, message: 'OK' };
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Unified referral dashboard' })
  async dashboard(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.getReferralDashboard(req.user.id);
    return { data, message: 'OK' };
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Ambassador leaderboard' })
  async leaderboard(
    @Query('period') period?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponse<unknown>> {
    const p = (period === 'month' || period === 'all' ? period : 'week') as 'week' | 'month' | 'all';
    const data = await this.ambassador.getLeaderboard(
      p,
      limit ? parseInt(limit, 10) : 20,
    );
    return { data, message: 'OK' };
  }

  @Get('achievements')
  @ApiOperation({ summary: 'My ambassador achievements' })
  async achievements(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.listAchievements(req.user.id);
    return { data, message: 'OK' };
  }

  @Post('convert-commission/:commissionId')
  @ApiOperation({ summary: 'Convert approved influencer commission to loyalty points' })
  async convert(
    @Request() req: { user: { id: string } },
    @Param('commissionId', ParseUUIDPipe) commissionId: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.ambassador.convertCommissionToPoints(req.user.id, commissionId);
    return { data, message: 'Converted' };
  }
}
