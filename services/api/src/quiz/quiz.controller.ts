import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ApiResponse } from '@hos-marketplace/shared-types';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { QuizService } from './quiz.service';
import { SubmitQuizDto } from './dto/submit-quiz.dto';

@ApiTags('quiz')
@ApiBearerAuth('JWT-auth')
@Controller('quiz')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuizController {
  constructor(private quiz: QuizService) {}

  @Get()
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'List active fandom quizzes' })
  async list(
    @Query('fandomId') fandomId?: string,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.quiz.listQuizzes(fandomId);
    return { data, message: 'OK' };
  }

  @Get('history')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'My quiz attempts' })
  async history(@Request() req: { user: { id: string } }): Promise<ApiResponse<unknown>> {
    const data = await this.quiz.myHistory(req.user.id);
    return { data, message: 'OK' };
  }

  @Get(':id')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Get quiz questions (no answers)' })
  async one(@Param('id') id: string): Promise<ApiResponse<unknown>> {
    const data = await this.quiz.getQuizForPlayer(id);
    return { data, message: 'OK' };
  }

  @Post(':id/submit')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Submit quiz answers' })
  async submit(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
    @Body() body: SubmitQuizDto,
  ): Promise<ApiResponse<unknown>> {
    const data = await this.quiz.submitQuiz(req.user.id, id, body.answers);
    return { data, message: 'OK' };
  }

}
