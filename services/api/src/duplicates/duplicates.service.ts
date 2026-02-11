import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { randomUUID } from 'crypto';

const REJECT_OTHERS_REASON =
  "Duplicate: another seller's submission approved for this product.";

interface SimilarityResult {
  productId: string;
  similarityScore: number;
  reasons: string[];
}

/** One submission in a cross-seller duplicate group */
export interface CrossSellerDuplicateSubmission {
  id: string;
  sellerId: string;
  sellerStoreName: string;
  sellerSlug: string;
  productName: string;
  productData: Record<string, unknown>;
  createdAt: Date;
  status: string;
}

/** A group of submissions from different sellers that represent the same product */
export interface CrossSellerDuplicateGroup {
  groupId: string;
  submissions: CrossSellerDuplicateSubmission[];
  matchReasons: string[];
  suggestedPrimaryId: string; // Oldest submission id - recommend approving this one
}

@Injectable()
export class DuplicatesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Detect duplicate products for a submission
   * Uses similarity scoring based on name, SKU, barcode, EAN
   */
  async detectDuplicates(submissionId: string): Promise<SimilarityResult[]> {
    const submission = await this.prisma.productSubmission.findUnique({
      where: { id: submissionId },
    });

    if (!submission) {
      return [];
    }

    const productData = submission.productData as any;
    const duplicates: SimilarityResult[] = [];

    // Get all active products
    const existingProducts = await this.prisma.product.findMany({
      where: {
        status: {
          in: ['ACTIVE', 'DRAFT'],
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        ean: true,
        slug: true,
      },
    });

    for (const product of existingProducts) {
      let similarityScore = 0;
      const reasons: string[] = [];

      // Check SKU match (exact match = 100% similarity)
      if (productData.sku && product.sku && productData.sku === product.sku) {
        similarityScore = 100;
        reasons.push('Exact SKU match');
        duplicates.push({
          productId: product.id,
          similarityScore,
          reasons,
        });
        continue;
      }

      // Check barcode match (exact match = 100% similarity)
      if (productData.barcode && product.barcode && productData.barcode === product.barcode) {
        similarityScore = 100;
        reasons.push('Exact barcode match');
        duplicates.push({
          productId: product.id,
          similarityScore,
          reasons,
        });
        continue;
      }

      // Check EAN match (exact match = 100% similarity)
      if (productData.ean && product.ean && productData.ean === product.ean) {
        similarityScore = 100;
        reasons.push('Exact EAN match');
        duplicates.push({
          productId: product.id,
          similarityScore,
          reasons,
        });
        continue;
      }

      // Check name similarity (fuzzy match)
      if (productData.name && product.name) {
        const nameSimilarity = this.calculateStringSimilarity(
          productData.name.toLowerCase(),
          product.name.toLowerCase(),
        );

        if (nameSimilarity > 80) {
          similarityScore = Math.max(similarityScore, nameSimilarity);
          reasons.push(`Name similarity: ${nameSimilarity.toFixed(1)}%`);
        }
      }

      // If similarity is high enough, add to duplicates
      if (similarityScore >= 80) {
        duplicates.push({
          productId: product.id,
          similarityScore,
          reasons,
        });
      }
    }

    // Sort by similarity score (highest first)
    duplicates.sort((a, b) => b.similarityScore - a.similarityScore);

    // Save duplicate detections to database
    for (const duplicate of duplicates) {
      await this.prisma.duplicateProduct.upsert({
        where: {
          submissionId_existingProductId: {
            submissionId,
            existingProductId: duplicate.productId,
          },
        },
        create: {
          submissionId,
          existingProductId: duplicate.productId,
          similarityScore: duplicate.similarityScore,
        },
        update: {
          similarityScore: duplicate.similarityScore,
        },
      });
    }

    return duplicates;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * Returns a percentage (0-100)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) {
      return 100;
    }

    const distance = this.levenshteinDistance(longer, shorter);
    return ((longer.length - distance) / longer.length) * 100;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1, // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Find groups of submissions from different sellers that represent the same product.
   * Used by procurement and catalogue to approve only one per product across sellers/wholesalers.
   * Matches on: exact SKU, barcode, or EAN; or name similarity >= 85%.
   */
  async findCrossSellerDuplicateGroups(): Promise<CrossSellerDuplicateGroup[]> {
    const submissions = await this.prisma.productSubmission.findMany({
      where: {
        status: { in: ['SUBMITTED', 'UNDER_REVIEW'] },
      },
      include: {
        seller: {
          select: { id: true, storeName: true, slug: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (submissions.length === 0) return [];

    const n = submissions.length;
    const parent = Array.from({ length: n }, (_, i) => i);

    const find = (i: number): number => {
      if (parent[i] !== i) parent[i] = find(parent[i]);
      return parent[i];
    };
    const union = (i: number, j: number) => {
      const pi = find(i);
      const pj = find(j);
      if (pi !== pj) parent[pi] = pj;
    };

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (submissions[i].sellerId === submissions[j].sellerId) continue;
        const { match, reasons } = this.areSameProduct(
          submissions[i].productData as Record<string, unknown>,
          submissions[j].productData as Record<string, unknown>,
        );
        if (match) union(i, j);
      }
    }

    const groupByRoot = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!groupByRoot.has(root)) groupByRoot.set(root, []);
      groupByRoot.get(root)!.push(i);
    }

    const groups: CrossSellerDuplicateGroup[] = [];
    for (const indices of groupByRoot.values()) {
      if (indices.length < 2) continue; // Only groups with 2+ submissions (different sellers implied by match)
      const subs = indices.map((idx) => submissions[idx]);
      const matchReasons = this.inferMatchReasons(subs.map((s) => s.productData as Record<string, unknown>));
      const suggestedPrimaryId = subs[0].id; // Oldest
      groups.push({
        groupId: `group-${subs.map((s) => s.id).sort().join('-').slice(0, 50)}`,
        submissions: subs.map((s) => ({
          id: s.id,
          sellerId: s.sellerId,
          sellerStoreName: s.seller?.storeName ?? 'Unknown',
          sellerSlug: s.seller?.slug ?? '',
          productName: (s.productData as any)?.name ?? 'Unknown',
          productData: (s.productData as Record<string, unknown>) ?? {},
          createdAt: s.createdAt,
          status: s.status,
        })),
        matchReasons,
        suggestedPrimaryId,
      });
    }

    return groups;
  }

  /**
   * Check if two product payloads represent the same product (exact identifiers or high name similarity).
   */
  private areSameProduct(
    a: Record<string, unknown>,
    b: Record<string, unknown>,
  ): { match: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const skuA = (a?.sku as string)?.trim();
    const skuB = (b?.sku as string)?.trim();
    if (skuA && skuB && skuA === skuB) {
      reasons.push('Exact SKU match');
      return { match: true, reasons };
    }
    const barcodeA = (a?.barcode as string)?.trim();
    const barcodeB = (b?.barcode as string)?.trim();
    if (barcodeA && barcodeB && barcodeA === barcodeB) {
      reasons.push('Exact barcode match');
      return { match: true, reasons };
    }
    const eanA = (a?.ean as string)?.trim();
    const eanB = (b?.ean as string)?.trim();
    if (eanA && eanB && eanA === eanB) {
      reasons.push('Exact EAN match');
      return { match: true, reasons };
    }
    const nameA = (a?.name as string)?.trim().toLowerCase();
    const nameB = (b?.name as string)?.trim().toLowerCase();
    if (nameA && nameB) {
      const sim = this.calculateStringSimilarity(nameA, nameB);
      if (sim >= 85) {
        reasons.push(`Name similarity: ${sim.toFixed(1)}%`);
        return { match: true, reasons };
      }
    }
    return { match: false, reasons: [] };
  }

  private inferMatchReasons(productDataList: Record<string, unknown>[]): string[] {
    const reasons: string[] = [];
    const first = productDataList[0];
    if (!first) return reasons;
    const sku = (first.sku as string)?.trim();
    if (sku && productDataList.every((p) => (p?.sku as string)?.trim() === sku)) reasons.push('Same SKU');
    const barcode = (first.barcode as string)?.trim();
    if (barcode && productDataList.every((p) => (p?.barcode as string)?.trim() === barcode)) reasons.push('Same barcode');
    const ean = (first.ean as string)?.trim();
    if (ean && productDataList.every((p) => (p?.ean as string)?.trim() === ean)) reasons.push('Same EAN');
    const name = (first.name as string)?.trim();
    if (name && !reasons.length) reasons.push('Similar product name');
    return reasons;
  }

  /**
   * Get all duplicate detections for a submission
   */
  async getDuplicatesForSubmission(submissionId: string) {
    return this.prisma.duplicateProduct.findMany({
      where: { submissionId },
      include: {
        existingProduct: {
          select: {
            id: true,
            name: true,
            slug: true,
            sku: true,
            barcode: true,
            ean: true,
            price: true,
            status: true,
          },
        },
      },
      orderBy: {
        similarityScore: 'desc',
      },
    });
  }

  /**
   * Reject all submissions in a cross-seller duplicate group except the one to keep.
   * Use after approving one submission in the group.
   */
  async rejectOthersInGroup(groupId: string, keepSubmissionId: string): Promise<{ rejectedIds: string[] }> {
    const groups = await this.findCrossSellerDuplicateGroups();
    const group = groups.find((g) => g.groupId === groupId);
    if (!group) {
      throw new NotFoundException('Cross-seller duplicate group not found');
    }
    const keepId = keepSubmissionId;
    const toReject = group.submissions.filter((s) => s.id !== keepId);
    if (toReject.length === 0) {
      return { rejectedIds: [] };
    }
    const inGroupIds = new Set(group.submissions.map((s) => s.id));
    if (!inGroupIds.has(keepId)) {
      throw new BadRequestException('keepSubmissionId must be a submission in this group');
    }
    const rejectedIds: string[] = [];
    for (const sub of toReject) {
      const submission = await this.prisma.productSubmission.findUnique({
        where: { id: sub.id },
      });
      if (!submission || (submission.status !== 'SUBMITTED' && submission.status !== 'UNDER_REVIEW')) {
        continue;
      }
      await this.prisma.productSubmission.update({
        where: { id: sub.id },
        data: {
          status: 'PROCUREMENT_REJECTED',
          procurementNotes: [submission.procurementNotes, REJECT_OTHERS_REASON].filter(Boolean).join('\n\n'),
        },
      });
      rejectedIds.push(sub.id);
    }
    return { rejectedIds };
  }

  /**
   * Assign persisted crossSellerGroupId to all SUBMITTED/UNDER_REVIEW submissions
   * based on current cross-seller duplicate grouping. Use for reporting or run via cron.
   * Call after new submissions or periodically.
   */
  async assignCrossSellerGroupIds(): Promise<{ groupsAssigned: number; submissionsUpdated: number }> {
    const submissions = await this.prisma.productSubmission.findMany({
      where: { status: { in: ['SUBMITTED', 'UNDER_REVIEW'] } },
      orderBy: { createdAt: 'asc' },
    });

    if (submissions.length === 0) {
      return { groupsAssigned: 0, submissionsUpdated: 0 };
    }

    const n = submissions.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (i: number): number => {
      if (parent[i] !== i) parent[i] = find(parent[i]);
      return parent[i];
    };
    const union = (i: number, j: number) => {
      const pi = find(i);
      const pj = find(j);
      if (pi !== pj) parent[pi] = pj;
    };

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (submissions[i].sellerId === submissions[j].sellerId) continue;
        const { match } = this.areSameProduct(
          submissions[i].productData as Record<string, unknown>,
          submissions[j].productData as Record<string, unknown>,
        );
        if (match) union(i, j);
      }
    }

    const groupByRoot = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const root = find(i);
      if (!groupByRoot.has(root)) groupByRoot.set(root, []);
      groupByRoot.get(root)!.push(i);
    }

    let submissionsUpdated = 0;
    for (const indices of groupByRoot.values()) {
      if (indices.length < 2) {
        const id = submissions[indices[0]].id;
        const current = await this.prisma.productSubmission.findUnique({ where: { id }, select: { crossSellerGroupId: true } });
        if (current?.crossSellerGroupId) {
          await this.prisma.productSubmission.update({ where: { id }, data: { crossSellerGroupId: null } });
          submissionsUpdated++;
        }
        continue;
      }
      const groupId = randomUUID();
      for (const idx of indices) {
        await this.prisma.productSubmission.update({
          where: { id: submissions[idx].id },
          data: { crossSellerGroupId: groupId },
        });
        submissionsUpdated++;
      }
    }

    const groupsAssigned = Array.from(groupByRoot.values()).filter((arr) => arr.length >= 2).length;
    return { groupsAssigned, submissionsUpdated };
  }

  /**
   * Get all submissions with duplicate alerts
   */
  async getSubmissionsWithDuplicates() {
    const duplicates = await this.prisma.duplicateProduct.findMany({
      where: {
        submission: {
          status: {
            in: ['SUBMITTED', 'UNDER_REVIEW'],
          },
        },
      },
      include: {
        submission: {
          include: {
            seller: {
              select: {
                id: true,
                storeName: true,
                slug: true,
              },
            },
          },
        },
        existingProduct: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        similarityScore: 'desc',
      },
    });

    return duplicates;
  }
}
