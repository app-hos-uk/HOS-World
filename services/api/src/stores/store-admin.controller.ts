import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { StoreOnboardingService } from './store-onboarding.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { OnboardingStepDto } from './dto/onboarding-step.dto';

@ApiTags('admin-stores')
@ApiBearerAuth('JWT-auth')
@Controller('admin/stores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class StoreAdminController {
  constructor(private stores: StoreOnboardingService) {}

  @Get()
  @ApiOperation({ summary: 'List stores with onboarding status' })
  async list(): Promise<ApiResponse<unknown>> {
    const data = await this.stores.listStores();
    return { data, message: 'OK' };
  }

  @Post()
  @ApiOperation({ summary: 'Create store' })
  async create(@Body() dto: CreateStoreDto): Promise<ApiResponse<unknown>> {
    const data = await this.stores.createStore(dto);
    return { data, message: 'OK' };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Store detail and checklist' })
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.stores.getStore(id);
    return { data, message: 'OK' };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update store' })
  async patch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStoreDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.stores.updateStore(id, dto);
    return { data, message: 'OK' };
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate store (onboarding must be complete)' })
  async activate(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.stores.activateStore(id);
    return { data, message: 'OK' };
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate store' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.stores.deactivateStore(id);
    return { data, message: 'OK' };
  }

  @Post(':id/onboarding/step')
  @ApiOperation({ summary: 'Mark onboarding step complete' })
  async step(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OnboardingStepDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.stores.completeOnboardingStep(id, dto.step);
    return { data, message: 'OK' };
  }

  @Post(':id/onboarding/complete')
  @ApiOperation({ summary: 'Mark full onboarding complete' })
  async complete(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<unknown>> {
    const data = await this.stores.finishOnboarding(id);
    return { data, message: 'OK' };
  }
}
