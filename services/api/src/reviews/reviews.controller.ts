import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewHelpfulDto } from './dto/review-helpful.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('products/:productId')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Request() req: any,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() createReviewDto: CreateReviewDto,
  ): Promise<ApiResponse<any>> {
    const review = await this.reviewsService.create(req.user.id, productId, createReviewDto);
    return {
      data: review,
      message: 'Review created successfully',
    };
  }

  @Public()
  @Get('products/:productId')
  async findAll(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ): Promise<ApiResponse<any>> {
    const page = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = limitStr ? parseInt(limitStr, 10) : 10;
    const result = await this.reviewsService.findAll(productId, page, limit);
    return {
      data: result,
      message: 'Reviews retrieved successfully',
    };
  }

  @Public()
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const review = await this.reviewsService.findOne(id);
    return {
      data: review,
      message: 'Review retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  async update(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReviewDto: UpdateReviewDto,
  ): Promise<ApiResponse<any>> {
    const review = await this.reviewsService.update(id, req.user.id, updateReviewDto);
    return {
      data: review,
      message: 'Review updated successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<{ message: string }>> {
    await this.reviewsService.delete(id, req.user.id, req.user.role);
    return {
      data: { message: 'Review deleted successfully' },
      message: 'Review deleted successfully',
    };
  }

  @Public()
  @Post(':id/helpful')
  @HttpCode(HttpStatus.OK)
  async markHelpful(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() helpfulDto: ReviewHelpfulDto,
  ): Promise<ApiResponse<any>> {
    const review = await this.reviewsService.markHelpful(id, helpfulDto.helpful);
    return {
      data: review,
      message: 'Review marked as helpful',
    };
  }
}

