import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as PDFDocument from 'pdfkit';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ShippingSlipService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async generatePdf(shipmentId: string): Promise<Buffer> {
    const order = await this.prisma.storeShipmentRequest.findUnique({
      where: { id: shipmentId },
      include: {
        store: { select: { name: true, code: true, address: true, city: true } },
        groups: { include: { items: true, boxSize: true }, orderBy: { createdAt: 'asc' } },
        posSale: { include: { items: true } },
      },
    });
    if (!order) throw new NotFoundException('Shipping order not found');

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const orderNo = order.hosOrderNumber || order.id.slice(0, 8).toUpperCase();
      const lookupBase = (this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000').replace(/\/$/, '');
      const lookupUrl = `${lookupBase}/ship/lookup?store=${order.storeId}&q=${encodeURIComponent(orderNo)}`;

      doc.fontSize(20).font('Helvetica-Bold').text('House of Spells', 40, 40);
      doc.fontSize(11).font('Helvetica').fillColor('#555555').text('Packing & Shipping Slip', 40, 66);
      doc.fontSize(16).fillColor('#1a1a2e').font('Helvetica-Bold').text(orderNo, 320, 40, { align: 'right' });
      doc.fontSize(9).font('Helvetica').fillColor('#333333')
        .text(`Invoice: ${order.invoiceNumber || '—'}`, 320, 64, { align: 'right' })
        .text(`Store: ${order.store?.name || order.storeId}`, 320, 76, { align: 'right' })
        .text(`Status: ${order.status}`, 320, 88, { align: 'right' });

      doc.moveTo(40, 110).lineTo(555, 110).strokeColor('#cccccc').stroke();

      doc.fillColor('#1a1a2e').fontSize(10).font('Helvetica-Bold').text('Customer', 40, 122);
      doc.font('Helvetica').fontSize(10)
        .text(order.customerName || order.claimEmail || '—', 40, 138)
        .text(order.claimEmail || '', 40, 152)
        .text(order.customerPhone || '', 40, 166);

      doc.font('Helvetica-Bold').text('Lookup / barcode', 320, 122);
      doc.font('Helvetica').fontSize(8).fillColor('#555555').text(lookupUrl, 320, 138, { width: 230 });
      doc.fontSize(12).fillColor('#1a1a2e').font('Courier-Bold').text(orderNo, 320, 168);

      let y = 200;
      const groups = order.groups || [];
      doc.font('Helvetica-Bold').fontSize(11).text(`Boxes expected: ${groups.length || 1}`, 40, y);
      y += 18;
      if (order.specialInstructions) {
        doc.font('Helvetica').fontSize(9).fillColor('#7c3aed')
          .text(`Special instructions: ${order.specialInstructions}`, 40, y, { width: 510 });
        y += 24;
      }

      for (const [i, group] of groups.entries()) {
        if (y > 700) {
          doc.addPage();
          y = 40;
        }
        const dest = (group.destinationSnapshot || {}) as Record<string, string>;
        const destLine = [dest.street, dest.city, dest.postalCode, dest.country].filter(Boolean).join(', ');
        doc.fillColor('#1a1a2e').font('Helvetica-Bold').fontSize(11)
          .text(`Box ${i + 1} of ${groups.length} — ${group.boxSizeName || group.boxSize?.label || 'Unsized'}`, 40, y);
        y += 16;
        doc.font('Helvetica').fontSize(9).fillColor('#333333')
          .text(`To: ${group.recipientName || dest.firstName || 'Customer'}`, 40, y)
          .text(destLine || 'Address pending', 40, y + 12, { width: 510 });
        y += 32;
        doc.font('Helvetica-Bold').text('SKU', 40, y).text('Item', 140, y).text('Qty', 500, y);
        y += 14;
        for (const item of group.items) {
          doc.font('Helvetica').fontSize(9)
            .text(item.sku || '—', 40, y, { width: 90 })
            .text(item.name, 140, y, { width: 340 })
            .text(String(item.quantity), 500, y);
          y += 14;
        }
        y += 16;
      }

      if (groups.length === 0 && order.posSale?.items?.length) {
        doc.font('Helvetica-Bold').fontSize(11).fillColor('#1a1a2e').text('Invoice items (not yet assigned)', 40, y);
        y += 16;
        for (const item of order.posSale.items) {
          doc.font('Helvetica').fontSize(9).text(`${item.sku || '—'}  ${item.name}  ×${item.quantity}`, 40, y);
          y += 14;
        }
      }

      doc.fontSize(8).fillColor('#777777').text(
        'Scan the HOS order number at logistics intake, then scan each item while packing.',
        40,
        780,
        { width: 510 },
      );
      doc.end();
    });
  }
}
