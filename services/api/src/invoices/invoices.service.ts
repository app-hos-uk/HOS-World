import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async generateInvoicePdf(orderId: string): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        currency: true,
        subtotal: true,
        tax: true,
        total: true,
        shippingAmount: true,
        discountAmount: true,
        createdAt: true,
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
        items: {
          include: {
            product: { select: { name: true, sku: true, currency: true } },
          },
        },
        shippingAddress: true,
        billingAddress: true,
        seller: {
          select: {
            storeName: true,
            legalBusinessName: true,
            companyName: true,
            vatNumber: true,
            taxId: true,
            country: true,
            city: true,
          },
        },
        childOrders: {
          include: {
            seller: {
              select: {
                storeName: true,
                legalBusinessName: true,
                vatNumber: true,
                taxId: true,
              },
            },
            items: {
              include: {
                product: { select: { name: true, sku: true } },
              },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    return await this.buildPdf(order);
  }

  private buildPdf(order: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const currency = order.currency || 'USD';
      const currencySymbol =
        currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency;

      // Header — HoS branding
      doc.fontSize(24).font('Helvetica-Bold').text('House of Spells', 50, 50);
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#666666')
        .text('Centralised Multi-Vendor Fandom Ecommerce Platform', 50, 78);

      doc
        .fontSize(18)
        .fillColor('#000000')
        .font('Helvetica-Bold')
        .text('INVOICE', 400, 50, { align: 'right' });

      // Invoice details
      const invoiceDate = order.createdAt
        ? new Date(order.createdAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '';

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#333333')
        .text(`Invoice #: ${order.orderNumber}`, 400, 75, { align: 'right' })
        .text(`Date: ${invoiceDate}`, 400, 90, { align: 'right' })
        .text(`Status: ${order.status}`, 400, 105, { align: 'right' });

      // Divider
      doc.moveTo(50, 130).lineTo(545, 130).strokeColor('#cccccc').stroke();

      // Bill To
      let yPos = 145;
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text('Bill To:', 50, yPos);
      yPos += 15;
      const billing = order.billingAddress;
      if (billing) {
        doc.font('Helvetica').text(`${billing.firstName} ${billing.lastName}`, 50, yPos);
        yPos += 13;
        doc.text(billing.street, 50, yPos);
        yPos += 13;
        doc.text(`${billing.city}, ${billing.state || ''} ${billing.postalCode || ''}`, 50, yPos);
        yPos += 13;
        doc.text(billing.country, 50, yPos);
      }

      // Ship To
      yPos = 145;
      doc.font('Helvetica-Bold').text('Ship To:', 300, yPos);
      yPos += 15;
      const shipping = order.shippingAddress;
      if (shipping) {
        doc.font('Helvetica').text(`${shipping.firstName} ${shipping.lastName}`, 300, yPos);
        yPos += 13;
        doc.text(shipping.street, 300, yPos);
        yPos += 13;
        doc.text(
          `${shipping.city}, ${shipping.state || ''} ${shipping.postalCode || ''}`,
          300,
          yPos,
        );
        yPos += 13;
        doc.text(shipping.country, 300, yPos);
      }

      // Items table header
      yPos = Math.max(yPos + 30, 250);
      doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#333333').stroke();
      yPos += 8;

      doc
        .fontSize(9)
        .font('Helvetica-Bold')
        .text('Item', 50, yPos, { width: 230 })
        .text('SKU', 280, yPos, { width: 80 })
        .text('Qty', 360, yPos, { width: 40, align: 'right' })
        .text('Price', 410, yPos, { width: 60, align: 'right' })
        .text('Total', 480, yPos, { width: 65, align: 'right' });

      yPos += 15;
      doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#cccccc').stroke();
      yPos += 8;

      // Items — handle missing/deleted products gracefully
      doc.font('Helvetica').fontSize(9);
      for (const item of order.items || []) {
        const itemPrice = Number(item.price) || 0;
        const itemQty = Number(item.quantity) || 0;
        const lineTotal = itemPrice * itemQty;
        const productName = item.product?.name || item.productName || 'Deleted Product';
        const productSku = item.product?.sku || '—';

        doc
          .text(productName, 50, yPos, { width: 230 })
          .text(productSku, 280, yPos, { width: 80 })
          .text(String(itemQty), 360, yPos, { width: 40, align: 'right' })
          .text(`${currencySymbol}${itemPrice.toFixed(2)}`, 410, yPos, {
            width: 60,
            align: 'right',
          })
          .text(`${currencySymbol}${lineTotal.toFixed(2)}`, 480, yPos, {
            width: 65,
            align: 'right',
          });
        yPos += 18;

        if (yPos > 700) {
          doc.addPage();
          yPos = 50;
        }
      }

      // Totals
      yPos += 10;
      doc.moveTo(350, yPos).lineTo(545, yPos).strokeColor('#cccccc').stroke();
      yPos += 10;

      const subtotal = Number(order.subtotal) || 0;
      const shippingAmt = Number(order.shippingAmount) || 0;
      const discountAmt = Number(order.discountAmount) || 0;
      const taxAmt = Number(order.tax) || 0;
      const totalAmt = Number(order.total) || 0;

      doc
        .font('Helvetica')
        .text('Subtotal:', 350, yPos, { width: 120, align: 'right' })
        .text(`${currencySymbol}${subtotal.toFixed(2)}`, 480, yPos, {
          width: 65,
          align: 'right',
        });
      yPos += 15;

      if (shippingAmt > 0) {
        doc
          .text('Shipping:', 350, yPos, { width: 120, align: 'right' })
          .text(`${currencySymbol}${shippingAmt.toFixed(2)}`, 480, yPos, {
            width: 65,
            align: 'right',
          });
        yPos += 15;
      }

      if (discountAmt > 0) {
        doc
          .text('Discount:', 350, yPos, { width: 120, align: 'right' })
          .text(`-${currencySymbol}${discountAmt.toFixed(2)}`, 480, yPos, {
            width: 65,
            align: 'right',
          });
        yPos += 15;
      }

      doc
        .text('Tax:', 350, yPos, { width: 120, align: 'right' })
        .text(`${currencySymbol}${taxAmt.toFixed(2)}`, 480, yPos, {
          width: 65,
          align: 'right',
        });
      yPos += 18;

      doc.moveTo(350, yPos).lineTo(545, yPos).strokeColor('#333333').stroke();
      yPos += 8;

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .text('Total:', 350, yPos, { width: 120, align: 'right' })
        .text(`${currencySymbol}${totalAmt.toFixed(2)}`, 480, yPos, {
          width: 65,
          align: 'right',
        });

      // Vendor details (visible on invoice per spec — vendors hidden on storefront but shown here)
      if (order.childOrders?.length > 0) {
        yPos += 40;
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }

        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#000000')
          .text('Fulfilled By:', 50, yPos);
        yPos += 15;

        doc.font('Helvetica').fontSize(9);
        for (const child of order.childOrders) {
          if (child.seller) {
            const vendorName = child.seller.legalBusinessName || child.seller.storeName;
            const taxRef =
              child.seller.vatNumber || child.seller.taxId
                ? ` (Tax ID: ${child.seller.vatNumber || child.seller.taxId})`
                : '';
            doc.text(`• ${vendorName}${taxRef}`, 60, yPos);
            yPos += 13;
          }
        }
      } else if (order.seller) {
        yPos += 40;
        doc.fontSize(10).font('Helvetica-Bold').text('Fulfilled By:', 50, yPos);
        yPos += 15;
        doc
          .font('Helvetica')
          .fontSize(9)
          .text(
            `${order.seller.legalBusinessName || order.seller.storeName}${
              order.seller.vatNumber ? ` (VAT: ${order.seller.vatNumber})` : ''
            }`,
            60,
            yPos,
          );
      }

      // Footer
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#999999')
        .text('House of Spells Ltd. — Thank you for your purchase!', 50, 760, {
          align: 'center',
          width: 495,
        });

      doc.end();
    });
  }
}
