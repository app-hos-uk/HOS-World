import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CancellationsService } from './cancellations.service';
import { RequestCancellationDto } from './dto/request-cancellation.dto';
import { ReviewCancellationDto } from './dto/review-cancellation.dto';
import { SellerReviewCancellationDto } from './dto/seller-review-cancellation.dto';
import { EscalateCancellationDto } from './dto/escalate-cancellation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('cancellations')
@ApiBearerAuth('JWT-auth')
@Controller('cancellations')
@UseGuards(JwtAuthGuard)
export class CancellationsController {
  constructor(private readonly cancellationsService: CancellationsService) {}

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request order cancellation (paid orders require approval)' })
  async requestCancellation(@Request() req: any, @Body() dto: RequestCancellationDto) {
    const data = await this.cancellationsService.requestCancellation(req.user.id, dto);
    return {
      data,
      message:
        data.status === 'AUTO_APPROVED' || data.status === 'APPROVED'
          ? 'Order cancelled successfully'
          : 'Cancellation request submitted for review',
    };
  }

  @Get()
  @ApiOperation({ summary: 'List cancellation requests (role-scoped)' })
  async findAll(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.cancellationsService.findAll(req.user.id, req.user.role, {
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
    return {
      data: result.data,
      pagination: result.pagination,
      message: 'Cancellation requests retrieved successfully',
    };
  }

  @Get('order/:orderId')
  @ApiOperation({ summary: 'Get latest cancellation request for an order' })
  @ApiParam({ name: 'orderId', type: String })
  async findByOrder(@Request() req: any, @Param('orderId', ParseUUIDPipe) orderId: string) {
    const data = await this.cancellationsService.findByOrderId(orderId, req.user.id, req.user.role);
    return {
      data,
      message: data ? 'Cancellation request retrieved successfully' : 'No cancellation request found',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get cancellation request by ID' })
  @ApiParam({ name: 'id', type: String })
  async findOne(@Request() req: any, @Param('id', ParseUUIDPipe) id: string) {
    const data = await this.cancellationsService.findOne(id, req.user.id, req.user.role);
    return { data, message: 'Cancellation request retrieved successfully' };
  }

  @Put(':id/seller-review')
  @UseGuards(RolesGuard)
  @Roles('SELLER', 'B2C_SELLER', 'WHOLESALER')
  @ApiOperation({ summary: 'Seller approve or reject cancellation request' })
  async sellerReview(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SellerReviewCancellationDto,
  ) {
    const data = await this.cancellationsService.sellerReview(id, req.user.id, dto);
    return {
      data,
      message: dto.approved ? 'Cancellation forwarded to finance' : 'Cancellation request rejected',
    };
  }

  @Put(':id/finance-review')
  @UseGuards(RolesGuard)
  @Roles('FINANCE', 'ADMIN')
  @ApiOperation({ summary: 'Finance approve or reject cancellation request' })
  async financeReview(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewCancellationDto,
  ) {
    const data = await this.cancellationsService.financeReview(id, req.user.id, req.user.role, dto);
    return {
      data,
      message: dto.approved ? 'Cancellation approved and refund processed' : 'Cancellation request rejected',
    };
  }

  @Put(':id/escalate')
  @ApiOperation({ summary: 'Customer escalates rejected cancellation to admin' })
  async escalate(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EscalateCancellationDto,
  ) {
    const data = await this.cancellationsService.escalate(id, req.user.id, dto);
    return { data, message: 'Cancellation escalated to admin for review' };
  }

  @Put(':id/admin-resolve')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Admin resolves escalated or rejected cancellation' })
  async adminResolve(
    @Request() req: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewCancellationDto,
  ) {
    const data = await this.cancellationsService.adminResolve(id, req.user.id, dto);
    return {
      data,
      message: dto.approved ? 'Cancellation approved by admin' : 'Cancellation rejected by admin',
    };
  }
}
