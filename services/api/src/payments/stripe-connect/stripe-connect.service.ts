import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { StripeProvider } from '../providers/stripe.provider';

@Injectable()
export class StripeConnectService {
  private readonly logger = new Logger(StripeConnectService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeProvider: StripeProvider,
    private readonly configService: ConfigService,
  ) {}

  async createConnectedAccount(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
      include: { user: { select: { email: true } } },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');

    if (seller.stripeConnectAccountId) {
      throw new BadRequestException('Stripe Connect account already exists for this seller');
    }

    const result = await this.stripeProvider.createConnectedAccount({
      email: seller.user.email,
      businessName: seller.storeName,
      country: seller.country === 'UK' ? 'GB' : seller.country || 'US',
      metadata: {
        sellerId: seller.id,
        userId,
      },
    });

    await this.prisma.seller.update({
      where: { id: seller.id },
      data: { stripeConnectAccountId: result.accountId },
    });

    this.logger.log(`Stripe Connect account created for seller ${seller.id}: ${result.accountId}`);

    return result;
  }

  async getOnboardingLink(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');
    if (!seller.stripeConnectAccountId) {
      throw new BadRequestException('No Stripe Connect account found. Create one first.');
    }

    const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';

    const url = await this.stripeProvider.createAccountOnboardingLink(
      seller.stripeConnectAccountId,
      `${frontendUrl}/seller/stripe/return`,
      `${frontendUrl}/seller/stripe/refresh`,
    );

    return { url };
  }

  async getAccountStatus(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');
    if (!seller.stripeConnectAccountId) {
      return {
        hasAccount: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
    }

    const status = await this.stripeProvider.getConnectedAccountStatus(
      seller.stripeConnectAccountId,
    );

    // Update local flags if they changed
    if (
      status.payoutsEnabled !== seller.stripeConnectPayoutsEnabled ||
      status.detailsSubmitted !== seller.stripeConnectOnboarded
    ) {
      await this.prisma.seller.update({
        where: { id: seller.id },
        data: {
          stripeConnectOnboarded: status.detailsSubmitted,
          stripeConnectPayoutsEnabled: status.payoutsEnabled,
        },
      });
    }

    return {
      hasAccount: true,
      accountId: seller.stripeConnectAccountId,
      ...status,
    };
  }

  async getDashboardLink(userId: string) {
    const seller = await this.prisma.seller.findUnique({
      where: { userId },
    });
    if (!seller) throw new NotFoundException('Seller profile not found');
    if (!seller.stripeConnectAccountId) {
      throw new BadRequestException('No Stripe Connect account found');
    }

    const url = await this.stripeProvider.createLoginLink(seller.stripeConnectAccountId);
    return { url };
  }

  async createSplitPaymentIntent(params: {
    orderId: string;
    amount: number;
    currency: string;
    vendorAccountId: string;
    platformFee: number;
  }) {
    return this.stripeProvider.createPaymentIntentWithSplit({
      amount: params.amount,
      currency: params.currency,
      orderId: params.orderId,
      connectedAccountId: params.vendorAccountId,
      applicationFeeAmount: params.platformFee,
    });
  }

  async transferToVendor(params: {
    amount: number;
    currency: string;
    vendorAccountId: string;
    sourceTransaction?: string;
    description?: string;
    orderId?: string;
  }) {
    return this.stripeProvider.createTransfer({
      amount: params.amount,
      currency: params.currency,
      connectedAccountId: params.vendorAccountId,
      sourceTransaction: params.sourceTransaction,
      description: params.description,
      metadata: params.orderId ? { orderId: params.orderId } : undefined,
    });
  }
}
