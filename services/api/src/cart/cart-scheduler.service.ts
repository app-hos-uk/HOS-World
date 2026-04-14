import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

/** Idle time before a cart is considered abandoned for email (ms). */
const ABANDON_IDLE_MS = 24 * 60 * 60 * 1000;
/** Guest carts older than this are deleted (ms). */
const GUEST_CART_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
/** Empty authenticated carts older than this are deleted (ms). */
const EMPTY_USER_CART_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class CartSchedulerService {
  private readonly logger = new Logger(CartSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** Every 2 hours — email logged-in users with stale non-empty carts (once per idle cycle). */
  @Cron('0 */2 * * *')
  async detectAbandonedCarts(): Promise<void> {
    const cutoff = new Date(Date.now() - ABANDON_IDLE_MS);

    const carts = await this.prisma.cart.findMany({
      where: {
        userId: { not: null },
        abandonedEmailSentAt: null,
        updatedAt: { lt: cutoff },
        items: { some: {} },
      },
      include: {
        items: {
          include: {
            product: { select: { name: true } },
          },
        },
      },
    });

    for (const cart of carts) {
      if (!cart.userId) continue;

      try {
        const lines = cart.items.map((item) => ({
          name: item.product?.name || 'Product',
          quantity: item.quantity,
          lineTotal: Number(item.price) * item.quantity,
        }));

        await this.notificationsService.sendAbandonedCartEmail(cart.userId, lines, '$');

        await this.prisma.cart.update({
          where: { id: cart.id },
          data: { abandonedEmailSentAt: new Date() },
        });
      } catch (err: any) {
        this.logger.warn(
          `Abandoned cart email failed for cart ${cart.id}: ${err?.message ?? err}`,
        );
      }
    }

    if (carts.length) {
      this.logger.log(`Abandoned cart pass: processed ${carts.length} cart(s)`);
    }
  }

  /** Daily at 03:00 — purge old guest carts and long-idle empty user carts. */
  @Cron('0 3 * * *')
  async cleanupStaleCarts(): Promise<void> {
    const guestCutoff = new Date(Date.now() - GUEST_CART_MAX_AGE_MS);
    const guestDelete = await this.prisma.cart.deleteMany({
      where: {
        userId: null,
        updatedAt: { lt: guestCutoff },
      },
    });

    const emptyUserCutoff = new Date(Date.now() - EMPTY_USER_CART_MAX_AGE_MS);
    const staleEmpty = await this.prisma.cart.findMany({
      where: {
        userId: { not: null },
        updatedAt: { lt: emptyUserCutoff },
        items: { none: {} },
      },
      select: { id: true },
    });

    if (staleEmpty.length) {
      await this.prisma.cart.deleteMany({
        where: { id: { in: staleEmpty.map((c) => c.id) } },
      });
    }

    this.logger.log(
      `Cart cleanup: removed ${guestDelete.count} guest cart(s), ${staleEmpty.length} empty user cart(s)`,
    );
  }

  /** Daily at 09:00 — lightweight metrics for operations. */
  @Cron('0 9 * * *')
  async logAbandonedCartStats(): Promise<void> {
    const idleCutoff = new Date(Date.now() - ABANDON_IDLE_MS);

    const userCartsWithItems = await this.prisma.cart.count({
      where: {
        userId: { not: null },
        items: { some: {} },
      },
    });

    const pendingAbandonEmail = await this.prisma.cart.count({
      where: {
        userId: { not: null },
        abandonedEmailSentAt: null,
        updatedAt: { lt: idleCutoff },
        items: { some: {} },
      },
    });

    const emailed = await this.prisma.cart.count({
      where: {
        abandonedEmailSentAt: { not: null },
        items: { some: {} },
      },
    });

    this.logger.log(
      `Abandoned cart stats: user_carts_with_items=${userCartsWithItems} pending_email=${pendingAbandonEmail} carts_emailed=${emailed}`,
    );
  }
}
