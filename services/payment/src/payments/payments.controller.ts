import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, ParseIntPipe, DefaultValuePipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { GatewayAuthGuard, RolesGuard, Roles } from '@hos-marketplace/auth-common';

@ApiTags('payments')
@Controller('payments')
@UseGuards(GatewayAuthGuard)
@ApiBearerAuth('JWT-auth')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('intent')
  @HttpCode(HttpStatus.CREATED)
  async createPaymentIntent(@Request() req: any, @Body() data: { orderId: string; amount: number; currency?: string }) {
    const result = await this.paymentsService.createPaymentIntent({ ...data, userId: req.user.id });
    return { data: result, message: 'Payment intent created' };
  }

  @Post(':id/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPayment(@Param('id') id: string, @Body() body: { providerTransactionId: string }) {
    const result = await this.paymentsService.confirmPayment(id, body.providerTransactionId);
    return { data: result, message: 'Payment confirmed' };
  }

  @Get('transactions')
  async getTransactions(
    @Request() req: any,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    const result = await this.paymentsService.getTransactions(req.user.id, { page, limit });
    return { data: result, message: 'Transactions retrieved' };
  }

  @UseGuards(GatewayAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post(':id/refund')
  @HttpCode(HttpStatus.OK)
  async refund(@Param('id') id: string, @Body() body: { amount?: number }) {
    const result = await this.paymentsService.refund(id, body.amount);
    return { data: result, message: 'Refund processed' };
  }
}
