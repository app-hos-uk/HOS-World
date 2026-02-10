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
import {
  GatewayAuthGuard,
  RolesGuard,
  Roles,
  Public,
} from '@hos-marketplace/auth-common';

@ApiTags('newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Public()
  @Post('subscribe')
  @ApiOperation({
    summary: 'Subscribe to newsletter',
    description: 'Public endpoint to subscribe to the newsletter.',
  })
  @ApiBody({ type: CreateNewsletterSubscriptionDto })
  @SwaggerApiResponse({ status: 201, description: 'Successfully subscribed' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid email' })
  async subscribe(
    @Body() dto: CreateNewsletterSubscriptionDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    const subscription = await this.newsletterService.subscribe(dto, userId);
    return {
      data: subscription,
      message: 'Successfully subscribed to newsletter',
    };
  }

  @Public()
  @Post('unsubscribe')
  @ApiOperation({ summary: 'Unsubscribe from newsletter' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Successfully unsubscribed' })
  async unsubscribe(@Body('email') email: string) {
    await this.newsletterService.unsubscribe(email);
    return {
      data: { message: 'Successfully unsubscribed from newsletter' },
      message: 'Successfully unsubscribed',
    };
  }

  @Public()
  @Get('status')
  @ApiOperation({ summary: 'Get subscription status' })
  @ApiQuery({ name: 'email', required: true, type: String })
  @SwaggerApiResponse({ status: 200, description: 'Status retrieved' })
  async getStatus(@Query('email') email: string) {
    const status = await this.newsletterService.getSubscriptionStatus(email);
    return {
      data: status,
      message: 'Subscription status retrieved successfully',
    };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Get('subscriptions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all newsletter subscriptions (Admin only)' })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @SwaggerApiResponse({ status: 200, description: 'Subscriptions retrieved' })
  async getAllSubscriptions(
    @Query('status') status?: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number = 50,
  ) {
    const result = await this.newsletterService.getAllSubscriptions(
      status,
      page,
      limit,
    );
    return {
      data: result,
      message: 'Subscriptions retrieved successfully',
    };
  }
}
