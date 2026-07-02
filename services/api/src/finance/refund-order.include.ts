/** Prisma include for order data needed during return refund processing. */
export const RETURN_REFUND_ORDER_INCLUDE = {
  seller: { select: { id: true, commissionRate: true } },
  childOrders: {
    include: { seller: { select: { id: true, commissionRate: true } } },
  },
} as const;
