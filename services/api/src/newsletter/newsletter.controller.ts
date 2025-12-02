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
} from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { CreateNewsletterSubscriptionDto } from './dto/create-newsletter-subscription.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Public()
  @Post('subscribe')
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
  async unsubscribe(@Body('email') email: string): Promise<ApiResponse<{ message: string }>> {
    await this.newsletterService.unsubscribe(email);
    return {
      data: { message: 'Successfully unsubscribed from newsletter' },
      message: 'Successfully unsubscribed',
    };
  }

  @Public()
  @Get('status')
  async getStatus(@Query('email') email: string): Promise<ApiResponse<any>> {
    const status = await this.newsletterService.getSubscriptionStatus(email);
    return {
      data: status,
      message: 'Subscription status retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('subscriptions')
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

