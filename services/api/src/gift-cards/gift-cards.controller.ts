import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { GiftCardsService } from './gift-cards.service';
import { CreateGiftCardDto } from './dto/create-gift-card.dto';
import { RedeemGiftCardDto } from './dto/redeem-gift-card.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@Controller('gift-cards')
export class GiftCardsController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Request() req: any,
    @Body() dto: CreateGiftCardDto,
  ): Promise<ApiResponse<any>> {
    const giftCard = await this.giftCardsService.create(req.user.id, dto);
    return {
      data: giftCard,
      message: 'Gift card created successfully',
    };
  }

  @Public()
  @Get('validate/:code')
  async validate(@Param('code') code: string): Promise<ApiResponse<any>> {
    const result = await this.giftCardsService.validate(code);
    return {
      data: result,
      message: 'Gift card validated successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('redeem')
  async redeem(
    @Request() req: any,
    @Body() dto: RedeemGiftCardDto,
  ): Promise<ApiResponse<any>> {
    const giftCard = await this.giftCardsService.redeem(req.user.id, dto);
    return {
      data: giftCard,
      message: 'Gift card redeemed successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-gift-cards')
  async getMyGiftCards(@Request() req: any): Promise<ApiResponse<any[]>> {
    const giftCards = await this.giftCardsService.getMyGiftCards(req.user.id);
    return {
      data: giftCards,
      message: 'Gift cards retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/transactions')
  async getTransactions(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ApiResponse<any[]>> {
    const transactions = await this.giftCardsService.getTransactions(id, req.user.id);
    return {
      data: transactions,
      message: 'Transactions retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post(':id/refund')
  async refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { orderId: string; amount: number },
  ): Promise<ApiResponse<any>> {
    const giftCard = await this.giftCardsService.refund(id, body.orderId, body.amount);
    return {
      data: giftCard,
      message: 'Gift card refunded successfully',
    };
  }
}

