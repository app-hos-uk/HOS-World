import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GatewayAuthGuard, Roles, CurrentUser, AuthUser } from '@hos-marketplace/auth-common';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post()
  @UseGuards(GatewayAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() body: any) {
    return this.reviewsService.create({ ...body, userId: user.id });
  }

  @Get('product/:productId')
  findByProduct(@Param('productId') productId: string) {
    return this.reviewsService.findByProduct(productId);
  }

  @Get('seller/:sellerId')
  findBySeller(@Param('sellerId') sellerId: string) {
    return this.reviewsService.findBySeller(sellerId);
  }

  @Post(':id/approve')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN')
  approve(@Param('id') id: string) {
    return this.reviewsService.approve(id);
  }

  @Delete(':id')
  @UseGuards(GatewayAuthGuard)
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.reviewsService.remove(id);
  }
}
