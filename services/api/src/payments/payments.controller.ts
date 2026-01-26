import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
  RawBodyRequest,
Version,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiHeader,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('payments')
@Version('1')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('intent')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create payment intent',
    description: 'Creates a Stripe payment intent for an order. Returns client secret for frontend confirmation.',
  })
  @ApiBody({ type: CreatePaymentDto })
  @SwaggerApiResponse({ status: 201, description: 'Payment intent created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Order not found' })
  async createPaymentIntent(
    @Request() req: any,
    @Body() createPaymentDto: CreatePaymentDto,
  ): Promise<ApiResponse<any>> {
    const result = await this.paymentsService.createPaymentIntent(
      req.user.id,
      createPaymentDto,
    );
    return {
      data: result,
      message: 'Payment intent created successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Confirm payment',
    description: 'Confirms a payment intent and marks the order as paid. Called after successful payment on frontend.',
  })
  @ApiBody({
    description: 'Payment confirmation data',
    schema: {
      type: 'object',
      required: ['paymentIntentId', 'orderId'],
      properties: {
        paymentIntentId: { type: 'string', description: 'Stripe payment intent ID' },
        orderId: { type: 'string', format: 'uuid', description: 'Order UUID' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Payment confirmed successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid payment or order' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Payment intent or order not found' })
  async confirmPayment(
    @Body() confirmDto: { paymentIntentId: string; orderId: string },
  ): Promise<ApiResponse<{ message: string }>> {
    await this.paymentsService.confirmPayment(confirmDto.paymentIntentId, confirmDto.orderId);
    return {
      data: { message: 'Payment confirmed successfully' },
      message: 'Payment confirmed',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('providers')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get available payment providers',
    description: 'Returns list of available payment providers.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Payment providers retrieved successfully' })
  async getProviders(): Promise<ApiResponse<string[]>> {
    const providers = this.paymentsService.getAvailableProviders();
    return {
      data: providers,
      message: 'Payment providers retrieved successfully',
    };
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Payment webhook handler',
    description: 'Handles payment provider webhook events. Public endpoint for payment providers to call.',
  })
  @ApiHeader({
    name: 'stripe-signature',
    description: 'Payment provider webhook signature',
    required: false,
  })
  @ApiHeader({
    name: 'x-provider',
    description: 'Payment provider name (stripe, klarna, etc.)',
    required: false,
  })
  @ApiBody({
    description: 'Raw webhook payload from payment provider',
    schema: {
      type: 'string',
      format: 'binary',
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Webhook received and processed' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleWebhook(
    @Request() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
    @Headers('x-provider') provider: string,
  ): Promise<ApiResponse<{ received: boolean }>> {
    const providerName = provider || 'stripe';
    await this.paymentsService.handleWebhook(req.rawBody, signature, providerName);
    return {
      data: { received: true },
      message: 'Webhook received',
    };
  }
}


