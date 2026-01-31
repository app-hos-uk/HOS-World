import { Controller, Post, Body, Param, Headers, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { KlarnaService } from './klarna.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('payments')
@Controller('payments/klarna')
export class KlarnaController {
  constructor(private readonly klarnaService: KlarnaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('session')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create Klarna session',
    description: 'Creates a Klarna payment session for an order.',
  })
  @ApiBody({
    description: 'Klarna session data',
    schema: {
      type: 'object',
      properties: {
        orderId: { type: 'string', format: 'uuid' },
        purchaseCountry: { type: 'string' },
        purchaseCurrency: { type: 'string' },
        locale: { type: 'string' },
        orderAmount: { type: 'number' },
        orderLines: { type: 'array' },
      },
    },
  })
  @SwaggerApiResponse({ status: 201, description: 'Klarna session created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async createSession(@Body() body: any): Promise<ApiResponse<any>> {
    const session = await this.klarnaService.createSession(body);
    return {
      data: session,
      message: 'Klarna session created successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Confirm Klarna payment',
    description: 'Confirms a Klarna payment using the authorization token.',
  })
  @ApiBody({
    description: 'Payment confirmation data',
    schema: {
      type: 'object',
      required: ['authorizationToken', 'orderId'],
      properties: {
        authorizationToken: { type: 'string', description: 'Klarna authorization token' },
        orderId: { type: 'string', format: 'uuid', description: 'Order UUID' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Payment confirmed successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid payment or order' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async confirmPayment(
    @Body() body: { authorizationToken: string; orderId: string },
  ): Promise<ApiResponse<any>> {
    const result = await this.klarnaService.confirmPayment(body.authorizationToken, body.orderId);
    return {
      data: result,
      message: 'Payment confirmed successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('capture/:orderId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Capture Klarna payment',
    description: 'Captures a Klarna payment. Can capture partial amounts.',
  })
  @ApiParam({ name: 'orderId', description: 'Klarna order ID', type: String })
  @ApiBody({
    description: 'Capture data',
    schema: {
      type: 'object',
      properties: {
        amount: {
          type: 'number',
          description: 'Amount to capture (optional, defaults to full amount)',
        },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Payment captured successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid capture amount' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Klarna order not found' })
  async capturePayment(
    @Param('orderId') klarnaOrderId: string,
    @Body() body: { amount?: number },
  ): Promise<ApiResponse<any>> {
    const result = await this.klarnaService.capturePayment(klarnaOrderId, body.amount);
    return {
      data: result,
      message: 'Payment captured successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('refund/:orderId')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Refund Klarna payment',
    description: 'Processes a refund for a Klarna payment.',
  })
  @ApiParam({ name: 'orderId', description: 'Klarna order ID', type: String })
  @ApiBody({
    description: 'Refund data',
    schema: {
      type: 'object',
      required: ['amount'],
      properties: {
        amount: { type: 'number', description: 'Refund amount' },
        description: { type: 'string', description: 'Refund description (optional)' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Refund processed successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid refund amount' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Klarna order not found' })
  async refundPayment(
    @Param('orderId') klarnaOrderId: string,
    @Body() body: { amount: number; description?: string },
  ): Promise<ApiResponse<any>> {
    const result = await this.klarnaService.refundPayment(
      klarnaOrderId,
      body.amount,
      body.description,
    );
    return {
      data: result,
      message: 'Refund processed successfully',
    };
  }

  @Public()
  @Post('webhook')
  @ApiOperation({
    summary: 'Klarna webhook handler',
    description: 'Handles Klarna webhook events. Public endpoint for Klarna to call.',
  })
  @ApiHeader({
    name: 'klarna-signature',
    description: 'Klarna signature header for webhook verification',
    required: true,
  })
  @ApiBody({
    description: 'Webhook payload from Klarna',
    schema: {
      type: 'object',
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Webhook received and processed' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid webhook signature' })
  async handleWebhook(
    @Body() payload: any,
    @Headers('klarna-signature') signature: string,
  ): Promise<ApiResponse<any>> {
    const result = await this.klarnaService.handleWebhook(payload, signature);
    return {
      data: result,
      message: 'Webhook received',
    };
  }
}
