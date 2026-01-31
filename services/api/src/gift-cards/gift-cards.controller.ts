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
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { GiftCardsService } from './gift-cards.service';
import { CreateGiftCardDto } from './dto/create-gift-card.dto';
import { RedeemGiftCardDto } from './dto/redeem-gift-card.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { ApiResponse } from '@hos-marketplace/shared-types';

@ApiTags('gift-cards')
@Controller('gift-cards')
export class GiftCardsController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Create gift card',
    description:
      'Creates a new gift card. Users can purchase gift cards for themselves or as gifts.',
  })
  @ApiBody({ type: CreateGiftCardDto })
  @SwaggerApiResponse({ status: 201, description: 'Gift card created successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid request data' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Request() req: any, @Body() dto: CreateGiftCardDto): Promise<ApiResponse<any>> {
    const giftCard = await this.giftCardsService.create(req.user.id, dto);
    return {
      data: giftCard,
      message: 'Gift card created successfully',
    };
  }

  @Public()
  @Get('validate/:code')
  @ApiOperation({
    summary: 'Validate gift card',
    description:
      'Validates a gift card code and returns its balance and status. Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'code', description: 'Gift card code', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Gift card validated successfully' })
  @SwaggerApiResponse({ status: 404, description: 'Gift card not found or invalid' })
  async validate(@Param('code') code: string): Promise<ApiResponse<any>> {
    const result = await this.giftCardsService.validate(code);
    return {
      data: result,
      message: 'Gift card validated successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('redeem')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Redeem gift card',
    description:
      "Redeems a gift card and adds its value to the user's account balance or applies it to an order.",
  })
  @ApiBody({ type: RedeemGiftCardDto })
  @SwaggerApiResponse({ status: 200, description: 'Gift card redeemed successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid gift card or already redeemed' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Gift card not found' })
  async redeem(@Request() req: any, @Body() dto: RedeemGiftCardDto): Promise<ApiResponse<any>> {
    const giftCard = await this.giftCardsService.redeem(req.user.id, dto);
    return {
      data: giftCard,
      message: 'Gift card redeemed successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-gift-cards')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get my gift cards',
    description: 'Retrieves all gift cards owned by the authenticated user.',
  })
  @SwaggerApiResponse({ status: 200, description: 'Gift cards retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyGiftCards(@Request() req: any): Promise<ApiResponse<any[]>> {
    const giftCards = await this.giftCardsService.getMyGiftCards(req.user.id);
    return {
      data: giftCards,
      message: 'Gift cards retrieved successfully',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/transactions')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Get gift card transactions',
    description: 'Retrieves all transactions (redemptions, refunds) for a specific gift card.',
  })
  @ApiParam({ name: 'id', description: 'Gift card UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Transactions retrieved successfully' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden - Cannot access this gift card' })
  @SwaggerApiResponse({ status: 404, description: 'Gift card not found' })
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
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({
    summary: 'Refund gift card',
    description:
      'Refunds a gift card amount back to the card after an order cancellation or return.',
  })
  @ApiParam({ name: 'id', description: 'Gift card UUID', type: String })
  @ApiBody({
    description: 'Refund data',
    schema: {
      type: 'object',
      required: ['orderId', 'amount'],
      properties: {
        orderId: { type: 'string', format: 'uuid', description: 'Order UUID' },
        amount: { type: 'number', description: 'Refund amount' },
      },
    },
  })
  @SwaggerApiResponse({ status: 200, description: 'Gift card refunded successfully' })
  @SwaggerApiResponse({ status: 400, description: 'Invalid refund amount or order' })
  @SwaggerApiResponse({ status: 401, description: 'Unauthorized' })
  @SwaggerApiResponse({ status: 404, description: 'Gift card or order not found' })
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
