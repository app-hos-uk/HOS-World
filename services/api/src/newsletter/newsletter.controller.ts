import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';
import { CreateNewsletterSubscriptionDto } from './dto/create-newsletter-subscription.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Public()
  @Post('subscribe')
  @ApiOperation({
    summary: 'Subscribe to newsletter',
    description:
      'Subscribes an email address to the newsletter. Public endpoint, no authentication required.',
  })
  @ApiBody({ type: CreateNewsletterSubscriptionDto })
  @SwaggerApiResponse({ status: 201, description: 'Successfully subscribed to newsletter' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid email or already subscribed' })
  async subscribe(
    @Body() dto: CreateNewsletterSubscriptionDto,
    @Request() req: any,
  ): Promise<ApiResponse<any>> {
    const userId = req.user?.id;
    const subscription = await this.newsletterService.subscribe(dto, userId);
    return {
      data: subscription,
      message: 'Successfully subscribed to newsletter',
    };
  }

  @Public()
  @Post('unsubscribe')
  @ApiOperation({
    summary: 'Unsubscribe from newsletter',
    description:
      'Unsubscribes an email address from the newsletter. Public endpoint, no authentication required.',
  })
  @ApiBody({
    description: 'Unsubscribe data',
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Successfully unsubscribed from newsletter' })
  @SwaggerApiResponse({ status: 404, description: 'Email not found in subscriptions' })
  async unsubscribe(@Body('email') email: string): Promise<ApiResponse<{ message: string }>> {
    await this.newsletterService.unsubscribe(email);
    return {
      data: { message: 'Successfully unsubscribed from newsletter' },
      message: 'Successfully unsubscribed',
    };
  }

  @Public()
  @Get('status')
  @ApiOperation({
    summary: 'Get subscription status',
    description:
      'Checks the subscription status for an email address. Public endpoint, no authentication required.',
  })
  @ApiQuery({ name: 'email', required: true, type: String, description: 'Email address to check' })
  @SwaggerApiResponse({ status: 200, description: 'Subscription status retrieved successfully' })
  async getStatus(@Query('email') email?: string): Promise<ApiResponse<any>> {
    if (!email?.trim()) {
      throw new BadRequestException('Email query parameter is required');
    }
    const status = await this.newsletterService.getSubscriptionStatus(email);
    return {
      data: status,
      message: 'Subscription status retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'MARKETING', 'CMS_EDITOR')
  @Get('subscriptions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get all newsletter subscriptions',
    description: 'Retrieves all newsletter subscriptions with pagination. Admin, Marketing, or CMS Editor access required.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    type: String,
    description: 'Filter by subscription status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 50)',
  })
  @SwaggerApiResponse({ status: 200, description: 'Subscriptions retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Admin/Marketing/CMS Editor access required' })
  async getAllSubscriptions(
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
  ): Promise<ApiResponse<any>> {
    const result = await this.newsletterService.getAllSubscriptions(status, page, limit);
    return {
      data: result,
      message: 'Subscriptions retrieved successfully',
    };
  }
}
