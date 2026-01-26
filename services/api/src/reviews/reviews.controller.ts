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
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { ReviewHelpfulDto } from './dto/review-helpful.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('reviews')
@Version('1')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('products/:productId')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create product review',
    description: 'Creates a new review for a product. User must have purchased the product to review it.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', type: String })
  @ApiBody({ type: CreateReviewDto })
  @SwaggerApiResponse({ status: 201, description: 'Review created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data or product not purchased' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Product not found' })
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
  @ApiOperation({
    summary: 'Get product reviews',
    description: 'Retrieves all reviews for a specific product. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'productId', description: 'Product UUID', type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 10)' })
  @SwaggerApiResponse({ status: 200, description: 'Reviews retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Product not found' })
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
  @ApiOperation({
    summary: 'Get review by ID',
    description: 'Retrieves a specific review by ID. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Review retrieved successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Review not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ApiResponse<any>> {
    const review = await this.reviewsService.findOne(id);
    return {
      data: review,
      message: 'Review retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Update review',
    description: 'Updates a review. Users can only update their own reviews.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID', type: String })
  @ApiBody({ type: UpdateReviewDto })
  @SwaggerApiResponse({ status: 200, description: 'Review updated successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot update this review' })
  @SwaggerApiResponse({ status: 404, description: 'Review not found' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Delete review',
    description: 'Deletes a review. Users can delete their own reviews, admins can delete any review.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Review deleted successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot delete this review' })
  @SwaggerApiResponse({ status: 404, description: 'Review not found' })
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
  @ApiOperation({
    summary: 'Mark review as helpful',
    description: 'Marks a review as helpful or not helpful. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'id', description: 'Review UUID', type: String })
  @ApiBody({ type: ReviewHelpfulDto })
  @SwaggerApiResponse({ status: 200, description: 'Review marked as helpful' })
  @SwaggerApiResponse({ status: 404, description: 'Review not found' })
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

