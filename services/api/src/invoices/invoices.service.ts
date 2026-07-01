import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import * as PDFDocument from 'pdfkit';

@Injectable()
export class InvoicesService {
  private readonly companyName: string;
  private readonly companyLegal: string;
  private readonly companyAddress: string;
  private readonly companyCity: string;
  private readonly companyCountry: string;
  private readonly companyPostal: string;
  private readonly companyVat: string;
  private readonly companyReg: string;
  private readonly companyEmail: string;
  private readonly companyPhone: string;
  private readonly companyWebsite: string;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    this.companyName = this.config.get<string>('INVOICE_COMPANY_NAME', 'House of Spells');
    this.companyLegal = this.config.get<string>('INVOICE_COMPANY_LEGAL', 'House of Spells Ltd.');
    this.companyAddress = this.config.get<string>('INVOICE_COMPANY_ADDRESS', '42 Diagon Passage');
    this.companyCity = this.config.get<string>('INVOICE_COMPANY_CITY', 'London');
    this.companyCountry = this.config.get<string>('INVOICE_COMPANY_COUNTRY', 'United Kingdom');
    this.companyPostal = this.config.get<string>('INVOICE_COMPANY_POSTAL', 'EC2A 4BX');
    this.companyVat = this.config.get<string>('INVOICE_COMPANY_VAT', 'GB123456789');
    this.companyReg = this.config.get<string>('INVOICE_COMPANY_REG', '12345678');
    this.companyEmail = this.config.get<string>('INVOICE_COMPANY_EMAIL', 'support@houseofspells.co.uk');
    this.companyPhone = this.config.get<string>('INVOICE_COMPANY_PHONE', '+44 20 7946 0958');
    this.companyWebsite = this.config.get<string>('INVOICE_COMPANY_WEBSITE', 'https://houseofspells.co.uk');
  }

  async generateInvoicePdf(orderId: string): Promise<Buffer> {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        currency: true,
        subtotal: true,
        tax: true,
        total: true,
        shippingAmount: true,
        discountAmount: true,
        createdAt: true,
        user: {
          select: { firstName: true, lastName: true, email: true, phone: true },
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
        currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency === 'USD' ? '$' : `${currency} `;

      const invoiceNumber = `INV-${order.orderNumber}`;
      const invoiceDate = order.createdAt
        ? new Date(order.createdAt).toLocaleDateString('en-GB', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })
        : '';

      // ─── HEADER: Company branding ───
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#1a1a2e').text(this.companyName, 50, 50);
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor('#555555')
        .text(this.companyLegal, 50, 76)
        .text(`${this.companyAddress}, ${this.companyCity}, ${this.companyPostal}`, 50, 87)
        .text(this.companyCountry, 50, 98)
        .text(`VAT: ${this.companyVat}  |  Reg: ${this.companyReg}`, 50, 109);

      // ─── HEADER: Invoice title + meta (right-aligned) ───
      doc
        .fontSize(20)
        .fillColor('#1a1a2e')
        .font('Helvetica-Bold')
        .text('INVOICE', 400, 50, { align: 'right' });

      const isPaid = (order.paymentStatus || '').toUpperCase() === 'PAID';
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#333333')
        .text(`Invoice No: ${invoiceNumber}`, 350, 76, { align: 'right' })
        .text(`Date: ${invoiceDate}`, 350, 89, { align: 'right' })
        .text(`Payment: ${order.paymentMethod || 'Card'}`, 350, 102, { align: 'right' });

      if (isPaid) {
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#16a34a')
          .text('PAID', 350, 116, { align: 'right' });
      } else {
        doc
          .fontSize(10)
          .font('Helvetica-Bold')
          .fillColor('#dc2626')
          .text(order.paymentStatus || 'UNPAID', 350, 116, { align: 'right' });
      }

      // ─── Divider ───
      doc.moveTo(50, 135).lineTo(545, 135).strokeColor('#e0e0e0').stroke();

      // ─── Bill To / Ship To ───
      let yPos = 150;

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a2e').text('BILL TO', 50, yPos);
      doc.text('SHIP TO', 300, yPos);
      yPos += 14;

      doc.font('Helvetica').fillColor('#333333').fontSize(9);

      const billing = order.billingAddress;
      if (billing) {
        doc.text(`${billing.firstName} ${billing.lastName}`, 50, yPos);
        yPos += 12;
        if (billing.company) {
          doc.text(billing.company, 50, yPos);
          yPos += 12;
        }
        doc.text(billing.street, 50, yPos);
        yPos += 12;
        if (billing.addressLine2) {
          doc.text(billing.addressLine2, 50, yPos);
          yPos += 12;
        }
        doc.text(`${billing.city}, ${billing.state || ''} ${billing.postalCode || ''}`.trim(), 50, yPos);
        yPos += 12;
        doc.text(billing.country, 50, yPos);
        yPos += 12;
        if (billing.phone) {
          doc.text(`Tel: ${billing.phone}`, 50, yPos);
          yPos += 12;
        }
      }

      // Customer email
      if (order.user?.email) {
        doc.text(`Email: ${order.user.email}`, 50, yPos);
        yPos += 12;
      }

      // Ship To column
      let yShip = 164;
      const shipping = order.shippingAddress;
      if (shipping) {
        doc.text(`${shipping.firstName} ${shipping.lastName}`, 300, yShip);
        yShip += 12;
        if (shipping.company) {
          doc.text(shipping.company, 300, yShip);
          yShip += 12;
        }
        doc.text(shipping.street, 300, yShip);
        yShip += 12;
        if (shipping.addressLine2) {
          doc.text(shipping.addressLine2, 300, yShip);
          yShip += 12;
        }
        doc.text(`${shipping.city}, ${shipping.state || ''} ${shipping.postalCode || ''}`.trim(), 300, yShip);
        yShip += 12;
        doc.text(shipping.country, 300, yShip);
        yShip += 12;
        if (shipping.phone) {
          doc.text(`Tel: ${shipping.phone}`, 300, yShip);
        }
      }

      // ─── Items table ───
      yPos = Math.max(yPos, yShip) + 20;
      doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#1a1a2e').lineWidth(0.75).stroke();
      yPos += 8;

      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .fillColor('#1a1a2e')
        .text('ITEM', 50, yPos, { width: 210 })
        .text('SKU', 260, yPos, { width: 70 })
        .text('QTY', 340, yPos, { width: 40, align: 'right' })
        .text('UNIT PRICE', 390, yPos, { width: 70, align: 'right' })
        .text('AMOUNT', 470, yPos, { width: 75, align: 'right' });

      yPos += 14;
      doc.moveTo(50, yPos).lineTo(545, yPos).strokeColor('#cccccc').lineWidth(0.5).stroke();
      yPos += 8;

      doc.font('Helvetica').fontSize(9).fillColor('#333333');

      for (const item of order.items || []) {
        const itemPrice = Number(item.price) || 0;
        const itemQty = Number(item.quantity) || 0;
        const lineTotal = itemPrice * itemQty;
        const productName = item.product?.name || item.productName || 'Product';
        const productSku = item.product?.sku || '—';

        doc
          .text(productName, 50, yPos, { width: 210 })
          .text(productSku, 260, yPos, { width: 70 })
          .text(String(itemQty), 340, yPos, { width: 40, align: 'right' })
          .text(`${currencySymbol}${itemPrice.toFixed(2)}`, 390, yPos, { width: 70, align: 'right' })
          .text(`${currencySymbol}${lineTotal.toFixed(2)}`, 470, yPos, { width: 75, align: 'right' });
        yPos += 18;

        if (yPos > 690) {
          doc.addPage();
          yPos = 50;
        }
      }

      // ─── Totals ───
      yPos += 10;
      doc.moveTo(340, yPos).lineTo(545, yPos).strokeColor('#cccccc').lineWidth(0.5).stroke();
      yPos += 10;

      const subtotal = Number(order.subtotal) || 0;
      const shippingAmt = Number(order.shippingAmount) || 0;
      const discountAmt = Number(order.discountAmount) || 0;
      const taxAmt = Number(order.tax) || 0;
      const totalAmt = Number(order.total) || 0;
      const taxRate = subtotal > 0 ? ((taxAmt / subtotal) * 100).toFixed(1) : '0.0';

      doc.font('Helvetica').fontSize(9).fillColor('#333333');
      doc
        .text('Subtotal:', 340, yPos, { width: 120, align: 'right' })
        .text(`${currencySymbol}${subtotal.toFixed(2)}`, 470, yPos, { width: 75, align: 'right' });
      yPos += 15;

      if (shippingAmt > 0) {
        doc
          .text('Shipping:', 340, yPos, { width: 120, align: 'right' })
          .text(`${currencySymbol}${shippingAmt.toFixed(2)}`, 470, yPos, { width: 75, align: 'right' });
        yPos += 15;
      }

      if (discountAmt > 0) {
        doc
          .fillColor('#16a34a')
          .text('Discount:', 340, yPos, { width: 120, align: 'right' })
          .text(`-${currencySymbol}${discountAmt.toFixed(2)}`, 470, yPos, { width: 75, align: 'right' });
        yPos += 15;
        doc.fillColor('#333333');
      }

      doc
        .text(`Tax (${taxRate}%):`, 340, yPos, { width: 120, align: 'right' })
        .text(`${currencySymbol}${taxAmt.toFixed(2)}`, 470, yPos, { width: 75, align: 'right' });
      yPos += 18;

      doc.moveTo(340, yPos).lineTo(545, yPos).strokeColor('#1a1a2e').lineWidth(0.75).stroke();
      yPos += 8;

      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#1a1a2e')
        .text('TOTAL:', 340, yPos, { width: 120, align: 'right' })
        .text(`${currencySymbol}${totalAmt.toFixed(2)}`, 470, yPos, { width: 75, align: 'right' });

      // ─── Vendor details ───
      if (order.childOrders?.length > 0) {
        yPos += 35;
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }

        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a2e').text('Fulfilled By:', 50, yPos);
        yPos += 14;

        doc.font('Helvetica').fontSize(8).fillColor('#333333');
        for (const child of order.childOrders) {
          if (child.seller) {
            const vendorName = child.seller.legalBusinessName || child.seller.storeName;
            const taxRef =
              child.seller.vatNumber || child.seller.taxId
                ? ` (Tax ID: ${child.seller.vatNumber || child.seller.taxId})`
                : '';
            doc.text(`• ${vendorName}${taxRef}`, 60, yPos);
            yPos += 12;
          }
        }
      } else if (order.seller) {
        yPos += 35;
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#1a1a2e').text('Fulfilled By:', 50, yPos);
        yPos += 14;
        const sellerTax = order.seller.vatNumber || order.seller.taxId;
        doc
          .font('Helvetica')
          .fontSize(8)
          .fillColor('#333333')
          .text(
            `${order.seller.legalBusinessName || order.seller.storeName}${sellerTax ? ` (VAT: ${sellerTax})` : ''}`,
            60,
            yPos,
          );
      }

      // ─── Footer: Legal & contact ───
      const footerY = 735;
      doc
        .moveTo(50, footerY)
        .lineTo(545, footerY)
        .strokeColor('#e0e0e0')
        .lineWidth(0.5)
        .stroke();

      doc
        .fontSize(7)
        .font('Helvetica')
        .fillColor('#888888')
        .text(
          `${this.companyLegal}  •  Registered in England & Wales No. ${this.companyReg}  •  VAT No. ${this.companyVat}`,
          50,
          footerY + 6,
          { align: 'center', width: 495 },
        )
        .text(
          `${this.companyAddress}, ${this.companyCity}, ${this.companyPostal}, ${this.companyCountry}`,
          50,
          footerY + 16,
          { align: 'center', width: 495 },
        )
        .text(
          `${this.companyEmail}  •  ${this.companyPhone}  •  ${this.companyWebsite}`,
          50,
          footerY + 26,
          { align: 'center', width: 495 },
        )
        .text(
          'Thank you for your purchase! Returns accepted within 30 days — see our Returns Policy for details.',
          50,
          footerY + 40,
          { align: 'center', width: 495 },
        );

      doc.end();
    });
  }
}
