import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface AgingBucket {
  label: string;
  count: number;
  totalAmount: number;
  items: Array<{ id: string; amount: number; createdAt: Date; type: string; description?: string }>;
}

@Injectable()
export class AgingService {
  constructor(private prisma: PrismaService) {}

  async getTransactionAging(): Promise<{ buckets: AgingBucket[]; summary: { totalCount: number; totalAmount: number } }> {
    const now = new Date();
    const ranges = [
      { label: '0-7 days', maxDays: 7 },
      { label: '8-14 days', maxDays: 14 },
      { label: '15-30 days', maxDays: 30 },
      { label: '31-60 days', maxDays: 60 },
      { label: '60+ days', maxDays: Infinity },
    ];

    const pendingTransactions = await this.prisma.transaction.findMany({
      where: { status: { in: ['PENDING', 'FAILED'] } },
      select: { id: true, amount: true, createdAt: true, type: true, description: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets: AgingBucket[] = ranges.map((r) => ({ label: r.label, count: 0, totalAmount: 0, items: [] }));
    let prevMax = 0;

    for (let i = 0; i < ranges.length; i++) {
      const maxDays = ranges[i].maxDays;
      for (const tx of pendingTransactions) {
        const ageDays = Math.floor((now.getTime() - tx.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        if (ageDays >= prevMax && (maxDays === Infinity ? true : ageDays < maxDays)) {
          buckets[i].count++;
          buckets[i].totalAmount += Number(tx.amount);
          if (buckets[i].items.length < 20) {
            buckets[i].items.push({
              id: tx.id,
              amount: Number(tx.amount),
              createdAt: tx.createdAt,
              type: tx.type,
              description: tx.description || undefined,
            });
          }
        }
      }
      prevMax = maxDays === Infinity ? prevMax : maxDays;
    }

    const totalCount = pendingTransactions.length;
    const totalAmount = pendingTransactions.reduce((sum, tx) => sum + Number(tx.amount), 0);

    return { buckets, summary: { totalCount, totalAmount } };
  }

  async getSettlementAging(): Promise<{ buckets: AgingBucket[]; summary: { totalCount: number; totalAmount: number } }> {
    const now = new Date();
    const ranges = [
      { label: '0-7 days', maxDays: 7 },
      { label: '8-14 days', maxDays: 14 },
      { label: '15-30 days', maxDays: 30 },
      { label: '31-60 days', maxDays: 60 },
      { label: '60+ days', maxDays: Infinity },
    ];

    const pendingSettlements = await this.prisma.settlement.findMany({
      where: { status: { in: ['PENDING', 'PROCESSING'] } },
      select: { id: true, netAmount: true, createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets: AgingBucket[] = ranges.map((r) => ({ label: r.label, count: 0, totalAmount: 0, items: [] }));
    let prevMax = 0;

    for (let i = 0; i < ranges.length; i++) {
      const maxDays = ranges[i].maxDays;
      for (const s of pendingSettlements) {
        const ageDays = Math.floor((now.getTime() - s.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        if (ageDays >= prevMax && (maxDays === Infinity ? true : ageDays < maxDays)) {
          buckets[i].count++;
          buckets[i].totalAmount += Number(s.netAmount);
          if (buckets[i].items.length < 20) {
            buckets[i].items.push({
              id: s.id,
              amount: Number(s.netAmount),
              createdAt: s.createdAt,
              type: 'SETTLEMENT',
              description: s.status,
            });
          }
        }
      }
      prevMax = maxDays === Infinity ? prevMax : maxDays;
    }

    const totalCount = pendingSettlements.length;
    const totalAmount = pendingSettlements.reduce((sum, s) => sum + Number(s.netAmount), 0);

    return { buckets, summary: { totalCount, totalAmount } };
  }

  async getDisputeAging(): Promise<{ buckets: AgingBucket[]; summary: { totalCount: number; totalAmount: number } }> {
    const now = new Date();
    const ranges = [
      { label: '0-7 days', maxDays: 7 },
      { label: '8-14 days', maxDays: 14 },
      { label: '15-30 days', maxDays: 30 },
      { label: '31-60 days', maxDays: 60 },
      { label: '60+ days', maxDays: Infinity },
    ];

    const openDisputes = await this.prisma.dispute.findMany({
      where: { status: { in: ['OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUIRED'] } },
      select: { id: true, amount: true, createdAt: true, reason: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const buckets: AgingBucket[] = ranges.map((r) => ({ label: r.label, count: 0, totalAmount: 0, items: [] }));
    let prevMax = 0;

    for (let i = 0; i < ranges.length; i++) {
      const maxDays = ranges[i].maxDays;
      for (const d of openDisputes) {
        const ageDays = Math.floor((now.getTime() - d.createdAt.getTime()) / (1000 * 60 * 60 * 24));
        if (ageDays >= prevMax && (maxDays === Infinity ? true : ageDays < maxDays)) {
          buckets[i].count++;
          buckets[i].totalAmount += Number(d.amount);
          if (buckets[i].items.length < 20) {
            buckets[i].items.push({
              id: d.id,
              amount: Number(d.amount),
              createdAt: d.createdAt,
              type: 'DISPUTE',
              description: d.reason || d.status,
            });
          }
        }
      }
      prevMax = maxDays === Infinity ? prevMax : maxDays;
    }

    const totalCount = openDisputes.length;
    const totalAmount = openDisputes.reduce((sum, d) => sum + Number(d.amount), 0);

    return { buckets, summary: { totalCount, totalAmount } };
  }

  async getFullAgingReport() {
    const [transactions, settlements, disputes] = await Promise.all([
      this.getTransactionAging(),
      this.getSettlementAging(),
      this.getDisputeAging(),
    ]);

    return { transactions, settlements, disputes };
  }
}
