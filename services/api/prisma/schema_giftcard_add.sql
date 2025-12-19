-- GiftCard Model Addition
-- Add this to schema.prisma if gift card feature is needed

model GiftCard {
  id              String        @id @default(uuid())
  code            String        @unique
  type            String        // "DIGITAL" | "PHYSICAL"
  amount          Decimal       @db.Decimal(10, 2)
  balance         Decimal       @db.Decimal(10, 2)
  currency        String        @default("GBP")
  status          String        @default("active") // "active" | "redeemed" | "expired" | "cancelled"
  issuedToEmail   String?
  issuedToName    String?
  purchasedByUserId String?
  purchasedBy     User?         @relation("GiftCardPurchases", fields: [purchasedByUserId], references: [id])
  expiresAt       DateTime?
  transactions    GiftCardTransaction[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([code])
  @@index([status])
  @@index([purchasedByUserId])
  @@map("gift_cards")
}

model GiftCardTransaction {
  id          String    @id @default(uuid())
  giftCardId  String
  giftCard    GiftCard  @relation(fields: [giftCardId], references: [id], onDelete: Cascade)
  type        String    // "PURCHASE" | "REDEMPTION" | "REFUND"
  amount      Decimal   @db.Decimal(10, 2)
  orderId     String?
  order       Order?    @relation(fields: [orderId], references: [id])
  description String?
  createdAt   DateTime  @default(now())

  @@index([giftCardId])
  @@index([orderId])
  @@map("gift_card_transactions")
}

-- Add to User model relations:
-- giftCardPurchases GiftCard[] @relation("GiftCardPurchases")

-- Add to Order model relations:
-- giftCardTransactions GiftCardTransaction[]


