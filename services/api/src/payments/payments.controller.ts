import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Headers,
  RawBodyRequest,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('intent')
  @HttpCode(HttpStatus.CREATED)
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
  async confirmPayment(
    @Body() confirmDto: { paymentIntentId: string; orderId: string },
  ): Promise<ApiResponse<{ message: string }>> {
    await this.paymentsService.confirmPayment(confirmDto.paymentIntentId, confirmDto.orderId);
    return {
      data: { message: 'Payment confirmed successfully' },
      message: 'Payment confirmed',
    };
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Request() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<ApiResponse<{ received: boolean }>> {
    await this.paymentsService.handleWebhook(req.rawBody, signature);
    return {
      data: { received: true },
      message: 'Webhook received',
    };
  }
}


