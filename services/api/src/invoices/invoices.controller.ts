import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  Request,
  Res,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse as SwaggerApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { InvoicesService } from './invoices.service';
import { PrismaService } from '../database/prisma.service';

@ApiTags('invoices')
@ApiBearerAuth('JWT-auth')
@Controller('invoices')
@UseGuards(JwtAuthGuard)
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('order/:orderId')
  @ApiOperation({
    summary: 'Download invoice PDF for an order',
    description:
      'Generates and downloads an HoS-branded invoice PDF. Customers can download their own invoices; sellers for their orders; admins for any.',
  })
  @ApiParam({ name: 'orderId', description: 'Order UUID', type: String })
  @SwaggerApiResponse({ status: 200, description: 'Invoice PDF generated' })
  @SwaggerApiResponse({ status: 403, description: 'Forbidden' })
  @SwaggerApiResponse({ status: 404, description: 'Order not found' })
  async downloadInvoice(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Request() req: any,
    @Res() res: Response,
  ): Promise<void> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        userId: true,
        sellerId: true,
        orderNumber: true,
        childOrders: { select: { sellerId: true } },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const role = req.user.role;
    const userId = req.user.id;

    const ALLOWED_ROLES = ['ADMIN', 'CUSTOMER', 'SELLER', 'B2C_SELLER', 'WHOLESALER'];
    if (!ALLOWED_ROLES.includes(role)) {
      throw new ForbiddenException('You do not have permission to download invoices');
    }

    if (role === 'CUSTOMER' && order.userId !== userId) {
      throw new ForbiddenException('You can only download invoices for your own orders');
    }

    if (role === 'SELLER' || role === 'B2C_SELLER' || role === 'WHOLESALER') {
      const seller = await this.prisma.seller.findUnique({
        where: { userId },
        select: { id: true },
      });
      const isDirectSeller = seller && order.sellerId === seller.id;
      const isChildOrderSeller =
        seller && order.childOrders?.some((child) => child.sellerId === seller.id);
      if (!seller || (!isDirectSeller && !isChildOrderSeller)) {
        throw new ForbiddenException('You can only download invoices for your own orders');
      }
    }

    // ADMIN role falls through — allowed to download any invoice

    const pdfBuffer = await this.invoicesService.generateInvoicePdf(orderId);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="HOS-Invoice-${order.orderNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
