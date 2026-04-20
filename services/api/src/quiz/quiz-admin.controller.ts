import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { QuizService } from './quiz.service';
import { CreateQuizDto } from './dto/create-quiz.dto';

@ApiTags('admin-quiz')
@ApiBearerAuth('JWT-auth')
@Controller('admin/quiz')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class QuizAdminController {
  constructor(private quiz: QuizService) {}

  @Get()
  @ApiOperation({ summary: 'List all quizzes' })
  async list(): Promise<ApiResponse<unknown>> {
    const data = await this.quiz.adminList();
    return { data, message: 'OK' };
  }

  @Get(':id/attempts')
  @ApiOperation({ summary: 'Quiz attempts' })
  async attempts(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const data = await this.quiz.adminAttempts(id);
    return { data, message: 'OK' };
  }

  @Post()
  @ApiOperation({ summary: 'Create quiz' })
  async create(@Body() dto: CreateQuizDto): Promise<ApiResponse<unknown>> {
    const data = await this.quiz.adminCreate(dto);
    return { data, message: 'Created' };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update quiz' })
  async update(
    @Param('id') id: string,
    @Body() body: Partial<CreateQuizDto>,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.quiz.adminUpdate(id, body);
    return { data, message: 'Updated' };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Deactivate quiz' })
  async remove(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    await this.quiz.adminDeactivate(id);
    return { data: null, message: 'Deactivated' };
  }
}
