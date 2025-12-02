import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('returns')
@UseGuards(JwtAuthGuard)
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: any,
    @Body() createReturnDto: CreateReturnDto,
  ): Promise<ApiResponse<any>> {
    const returnRequest = await this.returnsService.create(req.user.id, createReturnDto);
    return {
      data: returnRequest,
      message: 'Return request created successfully',
    };
  }

  @Get()
  async findAll(@Request() req: any): Promise<ApiResponse<any[]>> {
    const returns = await this.returnsService.findAll(req.user.id, req.user.role);
    return {
      data: returns,
      message: 'Return requests retrieved successfully',
    };
  }

  @Get(':id')
  async findOne(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const returnRequest = await this.returnsService.findOne(id, req.user.id, req.user.role);
    return {
      data: returnRequest,
      message: 'Return request retrieved successfully',
    };
  }

  @UseGuards(RolesGuard)
  @Roles('SELLER', 'ADMIN')
  @Put(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: { status: string; refundAmount?: number; refundMethod?: string },
  ): Promise<ApiResponse<any>> {
    const returnRequest = await this.returnsService.updateStatus(
      id,
      updateDto.status,
      updateDto.refundAmount,
      updateDto.refundMethod,
    );
    return {
      data: returnRequest,
      message: 'Return status updated successfully',
    };
  }
}


