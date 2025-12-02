import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { ProductSubmissionStatus } from '@prisma/client';

@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('WHOLESALER', 'B2C_SELLER', 'SELLER')
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Post()
  async create(
    @Request() req: any,
    @Body() createSubmissionDto: CreateSubmissionDto,
  ): Promise<ApiResponse<any>> {
    const submission = await this.submissionsService.create(
      req.user.id,
      createSubmissionDto,
    );
    return {
      data: submission,
      message: 'Product submission created successfully',
    };
  }

  @Post('bulk')
  async bulkCreate(
    @Request() req: any,
    @Body() body: { submissions: CreateSubmissionDto[] },
  ): Promise<ApiResponse<any>> {
    const result = await this.submissionsService.bulkCreate(
      req.user.id,
      body.submissions,
    );
    return {
      data: result,
      message: `${result.count} product submissions created successfully`,
    };
  }

  @Get()
  async findAll(
    @Request() req: any,
    @Query('status') status?: ProductSubmissionStatus,
  ): Promise<ApiResponse<any[]>> {
    const submissions = await this.submissionsService.findAll(req.user.id, status);
    return {
      data: submissions,
      message: 'Submissions retrieved successfully',
    };
  }

  @Get(':id')
  async findOne(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any>> {
    const submission = await this.submissionsService.findOne(id, req.user.id);
    return {
      data: submission,
      message: 'Submission retrieved successfully',
    };
  }

  @Put(':id')
  async update(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSubmissionDto: UpdateSubmissionDto,
  ): Promise<ApiResponse<any>> {
    const submission = await this.submissionsService.update(
      id,
      req.user.id,
      updateSubmissionDto,
    );
    return {
      data: submission,
      message: 'Submission updated successfully',
    };
  }

  @Delete(':id')
  async delete(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<{ message: string }>> {
    const result = await this.submissionsService.delete(id, req.user.id);
    return {
      data: result,
      message: result.message,
    };
  }
}

