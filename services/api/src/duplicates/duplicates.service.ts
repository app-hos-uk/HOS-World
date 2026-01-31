import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

interface SimilarityResult {
  productId: string;
  similarityScore: number;
  reasons: string[];
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
