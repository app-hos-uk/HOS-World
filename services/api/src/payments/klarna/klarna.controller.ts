import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  UseGuards,
} from '@nestjs/common';
import { KlarnaService } from './klarna.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('payments/klarna')
export class KlarnaController {
  constructor(private readonly klarnaService: KlarnaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('session')
  async createSession(@Body() body: any): Promise<ApiResponse<any>> {
    const session = await this.klarnaService.createSession(body);
    return {
      data: session,
      message: 'Klarna session created successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm')
  async confirmPayment(
    @Body() body: { authorizationToken: string; orderId: string },
  ): Promise<ApiResponse<any>> {
    const result = await this.klarnaService.confirmPayment(
      body.authorizationToken,
      body.orderId,
    );
    return {
      data: result,
      message: 'Payment confirmed successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('capture/:orderId')
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

