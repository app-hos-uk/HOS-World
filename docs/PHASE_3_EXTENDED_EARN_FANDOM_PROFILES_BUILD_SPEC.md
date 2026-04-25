# Phase 3 — Extended Earn Rules & Fandom Profiles: Composer 2 Build Spec

## The Enchanted Circle · House of Spells

**Branch:** `feature/loyalty-phase-3-earn-fandom`  
**Base:** `feature/loyalty-phase-1` (all Phase 1 + Phase 2 work merged)  
**Estimated:** 3–4 weeks  
**Architecture:** Modular monolith — all code inside `services/api` (NestJS) and `apps/web` (Next.js). No new services or databases.

---

## TABLE OF CONTENTS

1. [Pre-Build Checklist](#1-pre-build-checklist)
2. [Schema Changes (Prisma)](#2-schema-changes-prisma)
3. [Wire Loyalty Earn Events into Existing Services](#3-wire-loyalty-earn-events-into-existing-services)
4. [Quiz System](#4-quiz-system)
5. [Quest–Loyalty Integration](#5-questloyalty-integration)
6. [Referral System Enhancements](#6-referral-system-enhancements)
7. [Fandom Profile Service](#7-fandom-profile-service)
8. [Gamification Bridge (Legacy → Enchanted Circle)](#8-gamification-bridge-legacy--enchanted-circle)
9. [BullMQ Jobs & Scheduling](#9-bullmq-jobs--scheduling)
10. [REST API Endpoints](#10-rest-api-endpoints)
11. [Admin API Endpoints](#11-admin-api-endpoints)
12. [Frontend Pages](#12-frontend-pages)
13. [API Client Extensions](#13-api-client-extensions)
14. [Environment Variables](#14-environment-variables)
15. [Testing Strategy](#15-testing-strategy)
16. [Migration & Seed Script](#16-migration--seed-script)
17. [Acceptance Criteria](#17-acceptance-criteria)

---

## 1. PRE-BUILD CHECKLIST

Before starting Phase 3, confirm:

- [ ] Phase 1 + Phase 2 code compiles with zero TypeScript errors (`npx tsc --noEmit --skipLibCheck`)
- [ ] All 54+ loyalty & POS tests pass (`npx jest --testPathPattern="(loyalty|pos)"`)
- [ ] Prisma client is generated against the latest schema (`npx prisma generate`)
- [ ] The following Phase 1/2 models and services are functional:
  - `LoyaltyMembership` (with `fandomProfile` JSON field, `engagementCount`, `compositeScore`)
  - `LoyaltyEarnRule` (seeded actions: REVIEW, PHOTO_REVIEW, SOCIAL_SHARE, QUEST, QUIZ, CHECK_IN, EVENT_ATTENDANCE)
  - `LoyaltyReferral` (referralCode, referrerId, refereeId, status)
  - `LoyaltyListener` (onUserRegistered, onReviewSubmitted, onSocialShare)
  - `LoyaltyReferralService` (ensureReferralCode)
  - `LoyaltyWalletService` (applyDelta)
  - `LoyaltyTierEngine` (recalculateTier)
  - `LoyaltyEarnEngine` (processOrderComplete, processPosSale)
- [ ] Existing modules to integrate with:
  - `SocialSharingService` at `services/api/src/social-sharing/`
  - `GamificationService` at `services/api/src/gamification/`
  - `ProductReview` model exists with `rating`, `status`, `verified` fields
  - `Quest` / `UserQuest` models exist with `points`, `requirements`, `status`
  - `Fandom` model exists with `name`, `slug`, `characters`, `quests`

---

## 2. SCHEMA CHANGES (Prisma)

### 2.1 New Models

**FandomQuiz — lightweight quiz system tied to fandoms:**

```prisma
model FandomQuiz {
  id          String   @id @default(uuid())
  fandomId    String
  fandom      Fandom   @relation(fields: [fandomId], references: [id])
  title       String
  description String?  @db.Text
  questions   Json     // Array of { question, options: string[], correctIndex: number }
  pointsReward Int     @default(25)
  difficulty  String   @default("EASY") // EASY, MEDIUM, HARD
  isActive    Boolean  @default(true)
  startsAt    DateTime?
  endsAt      DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  attempts    FandomQuizAttempt[]

  @@index([fandomId])
  @@index([isActive])
  @@map("fandom_quizzes")
}

model FandomQuizAttempt {
  id          String   @id @default(uuid())
  quizId      String
  quiz        FandomQuiz @relation(fields: [quizId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  score       Int      // Number of correct answers
  totalQuestions Int
  pointsAwarded Int    @default(0)
  completedAt DateTime @default(now())

  @@index([userId])
  @@index([quizId, userId])
  @@map("fandom_quiz_attempts")
}
```

### 2.2 Model Additions

**Add to `Fandom` model:**

```prisma
model Fandom {
  // ... existing fields ...
  quizzes   FandomQuiz[]
}
```

**Add to `User` model:**

```prisma
model User {
  // ... existing fields ...
  quizAttempts  FandomQuizAttempt[]
}
```

**Add to `LoyaltyReferral` model (if not already present):**

```prisma
model LoyaltyReferral {
  // ... existing fields ...
  convertedOrderId  String?   // The first order that triggered conversion
  convertedAt       DateTime? // When the referral was converted
}
```

**Add to `SharedItem` model (for loyalty tracking):**

```prisma
model SharedItem {
  // ... existing fields ...
  loyaltyPointsAwarded  Int  @default(0)
}
```

### 2.3 Manual Migration Script

Create `services/api/prisma/migrations/20260430100000_phase3_earn_fandom/migration.sql`:

```sql
-- Phase 3: Extended Earn Rules & Fandom Profiles

-- FandomQuiz table
CREATE TABLE IF NOT EXISTS "fandom_quizzes" (
    "id" TEXT NOT NULL,
    "fandomId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "questions" JSONB NOT NULL,
    "pointsReward" INTEGER NOT NULL DEFAULT 25,
    "difficulty" TEXT NOT NULL DEFAULT 'EASY',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fandom_quizzes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fandom_quizzes_fandomId_fkey" FOREIGN KEY ("fandomId") REFERENCES "fandoms"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "fandom_quizzes_fandomId_idx" ON "fandom_quizzes"("fandomId");
CREATE INDEX IF NOT EXISTS "fandom_quizzes_isActive_idx" ON "fandom_quizzes"("isActive");

-- FandomQuizAttempt table
CREATE TABLE IF NOT EXISTS "fandom_quiz_attempts" (
    "id" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "totalQuestions" INTEGER NOT NULL,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "fandom_quiz_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fandom_quiz_attempts_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "fandom_quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fandom_quiz_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "fandom_quiz_attempts_userId_idx" ON "fandom_quiz_attempts"("userId");
CREATE INDEX IF NOT EXISTS "fandom_quiz_attempts_quizId_userId_idx" ON "fandom_quiz_attempts"("quizId", "userId");

-- LoyaltyReferral additions
ALTER TABLE "loyalty_referrals" ADD COLUMN IF NOT EXISTS "convertedOrderId" TEXT;
ALTER TABLE "loyalty_referrals" ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);

-- SharedItem loyalty tracking
ALTER TABLE "shared_items" ADD COLUMN IF NOT EXISTS "loyaltyPointsAwarded" INTEGER NOT NULL DEFAULT 0;
```

---

## 3. WIRE LOYALTY EARN EVENTS INTO EXISTING SERVICES

### 3.1 Problem Statement

Phase 1 created `LoyaltyListener` with `onReviewSubmitted()` and `onSocialShare()`, but these hooks are **not yet called** from their respective service modules. Phase 3 wires them in.

### 3.2 Product Review → Loyalty (REVIEW / PHOTO_REVIEW)

**File:** `services/api/src/products/product-reviews.service.ts` (or the relevant review creation path)

Find the method that creates/approves a `ProductReview` and add:

```typescript
// After the review is successfully created/approved:
try {
  await this.loyaltyListener.onReviewSubmitted(userId, review.id);
} catch (e) {
  this.logger.warn(`Loyalty review earn failed: ${(e as Error).message}`);
}
```

**Changes needed:**
1. Import `LoyaltyListener` from `../../loyalty/listeners/loyalty.listener`
2. Inject `LoyaltyListener` in the constructor
3. Add `LoyaltyModule` to the review module's imports (use `forwardRef` if circular)

**PHOTO_REVIEW distinction:** Modify `LoyaltyListener.onReviewSubmitted()` to detect photo reviews:

```typescript
async onReviewSubmitted(userId: string, reviewId: string): Promise<void> {
  // ... existing checks ...
  const review = await this.prisma.productReview.findUnique({
    where: { id: reviewId },
    include: { images: true }, // or check for attached media
  });
  
  // Determine action type
  const hasMedia = review?.images?.length > 0; // adjust based on actual schema
  const actionType = hasMedia ? 'PHOTO_REVIEW' : 'REVIEW';
  
  const rule = await this.prisma.loyaltyEarnRule.findFirst({
    where: { action: actionType, isActive: true },
  });
  const points = rule?.pointsAmount ?? (hasMedia ? 50 : 25);
  
  // ... rest of earn logic with actionType ...
}
```

### 3.3 Social Sharing → Loyalty (SOCIAL_SHARE)

**File:** `services/api/src/social-sharing/social-sharing.service.ts`

Find the method that records a share (likely `shareItem` or `createShare`) and add:

```typescript
// After the share is recorded:
try {
  await this.loyaltyListener.onSocialShare(userId, platform);
} catch (e) {
  this.logger.warn(`Loyalty social share earn failed: ${(e as Error).message}`);
}
```

**Important:** The `LoyaltyEarnRule` for `SOCIAL_SHARE` has `maxPerDay: 5`. The listener must enforce this:

```typescript
async onSocialShare(userId: string, platform: string): Promise<void> {
  // ... existing checks ...
  
  // Enforce daily limit
  const rule = await this.prisma.loyaltyEarnRule.findFirst({
    where: { action: 'SOCIAL_SHARE', isActive: true },
  });
  if (rule?.maxPerDay) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = await this.prisma.loyaltyTransaction.count({
      where: {
        membershipId: membership.id,
        source: 'SOCIAL_SHARE',
        createdAt: { gte: todayStart },
      },
    });
    if (todayCount >= rule.maxPerDay) return; // Silently skip
  }

  // ... credit points ...
}
```

### 3.4 Quest Completion → Loyalty (QUEST)

**File:** `services/api/src/gamification/gamification.service.ts`

Find the method that marks a `UserQuest` as completed and add:

```typescript
async completeQuest(userId: string, questId: string): Promise<void> {
  // ... existing completion logic ...
  
  const quest = await this.prisma.quest.findUnique({ where: { id: questId } });
  if (quest?.points) {
    try {
      await this.loyaltyListener.onQuestCompleted(userId, questId, quest.points);
    } catch (e) {
      this.logger.warn(`Loyalty quest earn failed: ${(e as Error).message}`);
    }
  }
}
```

**Add to `LoyaltyListener`:**

```typescript
async onQuestCompleted(userId: string, questId: string, questPoints: number): Promise<void> {
  if (this.config.get('LOYALTY_ENABLED') !== 'true') return;
  
  const membership = await this.prisma.loyaltyMembership.findUnique({
    where: { userId },
    include: { tier: true },
  });
  if (!membership) return;
  
  // Prevent duplicate awards for the same quest
  const existing = await this.prisma.loyaltyTransaction.findFirst({
    where: { membershipId: membership.id, source: 'QUEST', sourceId: questId },
  });
  if (existing) return;
  
  const points = questPoints; // Quest defines its own points (50–500)
  
  await this.wallet.applyDelta(membership.id, points, 'EARN', 'QUEST', {
    description: `Quest completed`,
    sourceId: questId,
  });
  
  await this.prisma.loyaltyMembership.update({
    where: { id: membership.id },
    data: {
      totalPointsEarned: { increment: points },
      engagementCount: { increment: 1 },
    },
  });
  
  await this.tierEngine.recalculateTier(membership.id);
}
```

### 3.5 Event Attendance → Loyalty (EVENT_ATTENDANCE)

**File:** To be wired in Phase 5 (Event Management). For now, add the listener method:

```typescript
async onEventAttended(userId: string, eventId: string): Promise<void> {
  // Same pattern as onQuestCompleted, but with action 'EVENT_ATTENDANCE'
  // Default points: 100 (from seed rule)
}
```

### 3.6 Frequency Limit Enforcement

The current `LoyaltyListener` does NOT enforce `maxPerDay` / `maxPerMonth` from `LoyaltyEarnRule`. This must be added as a utility method:

```typescript
private async isWithinLimits(
  membershipId: string,
  action: string,
  rule: { maxPerDay?: number | null; maxPerMonth?: number | null },
): Promise<boolean> {
  if (rule.maxPerDay) {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const dayCount = await this.prisma.loyaltyTransaction.count({
      where: { membershipId, source: action, createdAt: { gte: dayStart } },
    });
    if (dayCount >= rule.maxPerDay) return false;
  }
  if (rule.maxPerMonth) {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthCount = await this.prisma.loyaltyTransaction.count({
      where: { membershipId, source: action, createdAt: { gte: monthStart } },
    });
    if (monthCount >= rule.maxPerMonth) return false;
  }
  return true;
}
```

Apply this in `onReviewSubmitted`, `onSocialShare`, and all new handlers.

---

## 4. QUIZ SYSTEM

### 4.1 Module Structure

Create `services/api/src/quiz/`:

```
quiz/
├── quiz.module.ts
├── quiz.service.ts
├── quiz.controller.ts        — Customer-facing (take quiz)
├── quiz-admin.controller.ts  — Admin (CRUD quizzes)
└── dto/
    ├── create-quiz.dto.ts
    ├── submit-quiz.dto.ts
    └── quiz-response.dto.ts
```

### 4.2 Quiz Service

**`quiz.service.ts`:**

```typescript
@Injectable()
export class QuizService {
  constructor(
    private prisma: PrismaService,
    private loyaltyListener: LoyaltyListener,
  ) {}

  async getAvailableQuizzes(userId: string, fandomId?: string): Promise<FandomQuiz[]> {
    const where: any = { isActive: true };
    if (fandomId) where.fandomId = fandomId;
    
    // Exclude date-expired quizzes
    const now = new Date();
    where.OR = [
      { startsAt: null },
      { startsAt: { lte: now } },
    ];
    
    return this.prisma.fandomQuiz.findMany({
      where,
      include: { fandom: { select: { name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getQuizForAttempt(quizId: string): Promise<QuizPayload> {
    const quiz = await this.prisma.fandomQuiz.findUnique({
      where: { id: quizId, isActive: true },
      include: { fandom: { select: { name: true } } },
    });
    if (!quiz) throw new NotFoundException('Quiz not found');
    
    // Strip correct answers from client payload
    const questions = (quiz.questions as any[]).map((q, i) => ({
      index: i,
      question: q.question,
      options: q.options,
      // correctIndex intentionally omitted
    }));
    
    return { id: quiz.id, title: quiz.title, fandom: quiz.fandom?.name, questions };
  }

  async submitQuiz(userId: string, quizId: string, answers: number[]): Promise<QuizResult> {
    const quiz = await this.prisma.fandomQuiz.findUnique({ where: { id: quizId } });
    if (!quiz || !quiz.isActive) throw new NotFoundException('Quiz not found');
    
    // Enforce weekly limit (from QUIZ earn rule: maxPerMonth=4 ≈ weekly)
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);
    const recentAttempts = await this.prisma.fandomQuizAttempt.count({
      where: { userId, completedAt: { gte: weekAgo } },
    });
    if (recentAttempts >= (parseInt(process.env.QUIZ_MAX_PER_WEEK ?? '1', 10))) {
      throw new BadRequestException('Weekly quiz limit reached');
    }
    
    // Score the quiz
    const questions = quiz.questions as { question: string; options: string[]; correctIndex: number }[];
    let score = 0;
    for (let i = 0; i < questions.length; i++) {
      if (answers[i] === questions[i].correctIndex) score++;
    }
    
    // Award points if score meets threshold (≥50% correct)
    const passingScore = Math.ceil(questions.length * 0.5);
    const passed = score >= passingScore;
    const pointsAwarded = passed ? quiz.pointsReward : 0;
    
    const attempt = await this.prisma.fandomQuizAttempt.create({
      data: {
        quizId,
        userId,
        score,
        totalQuestions: questions.length,
        pointsAwarded,
      },
    });
    
    if (passed && pointsAwarded > 0) {
      try {
        await this.loyaltyListener.onQuizCompleted(userId, quizId, pointsAwarded);
      } catch (e) {
        // Non-blocking
      }
    }
    
    return {
      attemptId: attempt.id,
      score,
      totalQuestions: questions.length,
      passed,
      pointsAwarded,
      correctAnswers: questions.map((q) => q.correctIndex),
    };
  }
}
```

### 4.3 DTOs

**`create-quiz.dto.ts`:**

```typescript
export class CreateQuizDto {
  @IsUUID() fandomId: string;
  @IsString() @MinLength(3) title: string;
  @IsOptional() @IsString() description?: string;
  @IsArray() @ArrayMinSize(3) questions: {
    question: string;
    options: string[];
    correctIndex: number;
  }[];
  @IsOptional() @IsInt() @Min(1) pointsReward?: number;
  @IsOptional() @IsIn(['EASY', 'MEDIUM', 'HARD']) difficulty?: string;
  @IsOptional() @IsDateString() startsAt?: string;
  @IsOptional() @IsDateString() endsAt?: string;
}
```

**`submit-quiz.dto.ts`:**

```typescript
export class SubmitQuizDto {
  @IsArray() @IsInt({ each: true }) answers: number[];
}
```

### 4.4 Add `onQuizCompleted` to `LoyaltyListener`

```typescript
async onQuizCompleted(userId: string, quizId: string, points: number): Promise<void> {
  if (this.config.get('LOYALTY_ENABLED') !== 'true') return;
  
  const membership = await this.prisma.loyaltyMembership.findUnique({
    where: { userId },
  });
  if (!membership) return;
  
  await this.wallet.applyDelta(membership.id, points, 'EARN', 'QUIZ', {
    description: 'Fandom quiz completed',
    sourceId: quizId,
  });
  
  await this.prisma.loyaltyMembership.update({
    where: { id: membership.id },
    data: {
      totalPointsEarned: { increment: points },
      engagementCount: { increment: 1 },
    },
  });
  
  await this.tierEngine.recalculateTier(membership.id);
}
```

---

## 5. QUEST–LOYALTY INTEGRATION

### 5.1 Problem Statement

The existing `Quest` / `UserQuest` models and `GamificationService` handle quest tracking, but quest completions do NOT award loyalty points. Wire them in.

### 5.2 Modify `GamificationService`

**File:** `services/api/src/gamification/gamification.service.ts`

Find or create the quest completion method. If `UserQuest.status` is updated to `'COMPLETED'`:

```typescript
async completeQuest(userId: string, questId: string): Promise<UserQuest> {
  const userQuest = await this.prisma.userQuest.update({
    where: { userId_questId: { userId, questId } },
    data: { status: 'COMPLETED', completedAt: new Date() },
    include: { quest: true },
  });
  
  // Award loyalty points
  if (userQuest.quest.points > 0) {
    try {
      await this.loyaltyListener.onQuestCompleted(userId, questId, userQuest.quest.points);
    } catch (e) {
      this.logger.warn(`Loyalty quest earn failed: ${(e as Error).message}`);
    }
  }
  
  return userQuest;
}
```

### 5.3 Module Dependency

Add `LoyaltyModule` (via `forwardRef`) to `GamificationModule` imports. Inject `LoyaltyListener` in `GamificationService`.

---

## 6. REFERRAL SYSTEM ENHANCEMENTS

### 6.1 Current State

- `LoyaltyReferralService.ensureReferralCode()` generates codes with format `HOS-{PREFIX}-{HEX}`
- `LoyaltyListener.onUserRegistered()` handles referral conversion (credits both parties)
- `apps/web/src/app/loyalty/referral/page.tsx` shows referral info

### 6.2 Enhancements Required

**6.2.1 Branded referral code format:**

Update `LoyaltyReferralService.ensureReferralCode()`:

```typescript
// Current: HOS-{random}-{random}
// New: HOS-{FIRST_NAME}-{4_RANDOM_CHARS}
// Example: HOS-JAMES-A7F2

private generateCode(firstName?: string): string {
  const prefix = this.config.get<string>('LOYALTY_CARD_PREFIX', 'HOS');
  const name = (firstName || 'FRIEND').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
  const random = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `${prefix}-${name}-${random}`;
}
```

**6.2.2 Referral landing page:**

Create `apps/web/src/app/ref/[code]/page.tsx`:

```typescript
// Server component that:
// 1. Validates the referral code exists and hasn't expired
// 2. Sets a referral attribution cookie (30-day expiry)
// 3. Shows a branded welcome page with Enchanted Circle value props
// 4. CTA: "Sign up to get 200 bonus points" → redirects to /register?ref={code}
```

**Cookie strategy:**
- Cookie name: `hos_ref`
- Value: the referral code
- Max-age: 30 days
- On registration: read `hos_ref` cookie and pass it as `referralCode` to the enrollment flow

**6.2.3 Track conversion order:**

Update `LoyaltyListener.onUserRegistered()` to set `convertedOrderId` and `convertedAt` on the `LoyaltyReferral` when converting. The `convertedOrderId` will be set by a separate call when the referee's first order completes:

```typescript
// In earn.engine.ts processOrderComplete, after points are awarded:
const pendingReferral = await this.prisma.loyaltyReferral.findFirst({
  where: { refereeId: order.userId, status: 'CONVERTED', convertedOrderId: null },
});
if (pendingReferral) {
  await this.prisma.loyaltyReferral.update({
    where: { id: pendingReferral.id },
    data: { convertedOrderId: orderId },
  });
}
```

**6.2.4 Enhanced referral stats API response:**

Update the response from `GET /loyalty/referral`:

```typescript
{
  referralCode: "HOS-JAMES-A7F2",
  totalReferrals: 12,        // total created
  convertedReferrals: 8,     // status = CONVERTED
  pendingReferrals: 4,       // status = PENDING
  totalPointsEarned: 4000,   // 8 × 500
  shareUrl: "https://houseofspells.com/ref/HOS-JAMES-A7F2",
  recentReferrals: [
    { name: "Sarah M.", status: "CONVERTED", date: "2026-04-10", pointsEarned: 500 },
    ...
  ]
}
```

---

## 7. FANDOM PROFILE SERVICE

### 7.1 Module Structure

Create `services/api/src/loyalty/services/fandom-profile.service.ts`:

### 7.2 Data Sources for Affinity Scoring

| Source | Weight | How |
|--------|--------|-----|
| Purchase history | 40% | Order items → Product → fandom (via product.fandom or product category) |
| Wishlist items | 15% | WishlistItem → Product → fandom |
| User.favoriteFandoms | 10% | Explicit preference (String[]) |
| Quiz attempts | 10% | FandomQuizAttempt → FandomQuiz → Fandom |
| Quest completions | 10% | UserQuest → Quest → Fandom |
| Event attendance | 15% | EventAttendance → Event → Fandom (Phase 5, placeholder for now) |

### 7.3 Implementation

```typescript
@Injectable()
export class FandomProfileService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async computeProfile(userId: string): Promise<Record<string, number>> {
    const scores: Record<string, number> = {};
    
    // 1. Purchase history (40%)
    const orderItems = await this.prisma.orderItem.findMany({
      where: { order: { userId } },
      include: { product: { select: { fandom: true } } },
    });
    for (const item of orderItems) {
      if (item.product?.fandom) {
        scores[item.product.fandom] = (scores[item.product.fandom] || 0) + 4;
      }
    }
    
    // 2. Wishlist (15%)
    const wishlistItems = await this.prisma.wishlistItem.findMany({
      where: { wishlist: { userId } },
      include: { product: { select: { fandom: true } } },
    });
    for (const item of wishlistItems) {
      if (item.product?.fandom) {
        scores[item.product.fandom] = (scores[item.product.fandom] || 0) + 1.5;
      }
    }
    
    // 3. Explicit favorites (10%)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { favoriteFandoms: true },
    });
    for (const f of user?.favoriteFandoms ?? []) {
      scores[f] = (scores[f] || 0) + 2;
    }
    
    // 4. Quiz attempts (10%)
    const quizAttempts = await this.prisma.fandomQuizAttempt.findMany({
      where: { userId },
      include: { quiz: { include: { fandom: { select: { name: true } } } } },
    });
    for (const a of quizAttempts) {
      if (a.quiz.fandom?.name) {
        scores[a.quiz.fandom.name] = (scores[a.quiz.fandom.name] || 0) + 1;
      }
    }
    
    // 5. Quest completions (10%)
    const quests = await this.prisma.userQuest.findMany({
      where: { userId, status: 'COMPLETED' },
      include: { quest: { include: { fandom: { select: { name: true } } } } },
    });
    for (const uq of quests) {
      if (uq.quest.fandom?.name) {
        scores[uq.quest.fandom.name] = (scores[uq.quest.fandom.name] || 0) + 1;
      }
    }
    
    // Normalize to 0.0 – 1.0 scale
    const maxScore = Math.max(...Object.values(scores), 1);
    const normalized: Record<string, number> = {};
    for (const [fandom, score] of Object.entries(scores)) {
      normalized[fandom] = Math.round((score / maxScore) * 100) / 100;
    }
    
    return normalized;
  }

  async updateMemberProfile(userId: string): Promise<void> {
    const profile = await this.computeProfile(userId);
    await this.prisma.loyaltyMembership.updateMany({
      where: { userId },
      data: { fandomProfile: profile },
    });
  }

  async batchUpdateProfiles(): Promise<number> {
    const memberships = await this.prisma.loyaltyMembership.findMany({
      select: { userId: true },
    });
    let updated = 0;
    for (const m of memberships) {
      try {
        await this.updateMemberProfile(m.userId);
        updated++;
      } catch (e) {
        // Skip failed profiles
      }
    }
    return updated;
  }
}
```

### 7.4 Where Fandom Profile is Used (Future Phases)

- **Phase 4 (Marketing):** Segment emails/campaigns by fandom affinity
- **Phase 6 (Segmentation):** `fandomAffinity` as a segment condition
- **Phase 8 (Brand Partnerships):** Target fandom-specific campaigns
- **Product recommendations:** Personalize based on fandom affinity

---

## 8. GAMIFICATION BRIDGE (Legacy → Enchanted Circle)

### 8.1 Problem Statement

The existing `GamificationService.awardPoints()` increments `User.loyaltyPoints` directly (legacy). This creates a parallel point system that doesn't interact with `LoyaltyMembership.currentBalance`.

### 8.2 Solution

Modify `GamificationService.awardPoints()` to:

1. **Continue** updating `User.loyaltyPoints` for backward compatibility
2. **Also** credit the Enchanted Circle wallet if the user has a membership

```typescript
async awardPoints(userId: string, points: number, reason: string): Promise<void> {
  // Legacy path (keep for backward compat)
  await this.prisma.user.update({
    where: { id: userId },
    data: { loyaltyPoints: { increment: points } },
  });
  
  // Enchanted Circle bridge
  if (this.config.get('LOYALTY_ENABLED') === 'true') {
    const membership = await this.prisma.loyaltyMembership.findUnique({
      where: { userId },
    });
    if (membership) {
      try {
        await this.walletService.applyDelta(membership.id, points, 'EARN', 'GAMIFICATION', {
          description: reason,
        });
        await this.prisma.loyaltyMembership.update({
          where: { id: membership.id },
          data: { totalPointsEarned: { increment: points } },
        });
      } catch (e) {
        this.logger.warn(`Gamification→Loyalty bridge failed: ${(e as Error).message}`);
      }
    }
  }
}
```

### 8.3 Module Dependency

Add `LoyaltyModule` to `GamificationModule` imports. Inject `LoyaltyWalletService` in `GamificationService`.

---

## 9. BULLMQ JOBS & SCHEDULING

### 9.1 New Job Types

Add to `JobType` enum in `services/api/src/queue/queue.bullmq.impl.ts`:

```typescript
FANDOM_PROFILE_RECOMPUTE = 'loyalty:fandom-profile-recompute',
```

### 9.2 Fandom Profile Recompute Job

**File:** `services/api/src/loyalty/jobs/loyalty.jobs.ts`

Register a processor and cron:

```typescript
// In onModuleInit:
this.queue.registerProcessor(JobType.FANDOM_PROFILE_RECOMPUTE, async () => {
  const count = await this.fandomProfileService.batchUpdateProfiles();
  this.logger.log(`Fandom profiles recomputed: ${count}`);
});

// In scheduleCrons:
await this.queue.addRepeatable(
  JobType.FANDOM_PROFILE_RECOMPUTE,
  {},
  this.config.get<string>('FANDOM_PROFILE_RECOMPUTE_CRON', '0 5 * * 0'), // Weekly Sunday 5am
);
```

### 9.3 Inject `FandomProfileService` into `LoyaltyJobsService`

Update `loyalty.module.ts` to provide `FandomProfileService` and inject it in `LoyaltyJobsService`.

---

## 10. REST API ENDPOINTS

### 10.1 Quiz Endpoints (Customer-Facing)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | /api/v1/quiz | List available quizzes (filter by fandomId) | @Roles('CUSTOMER') |
| GET | /api/v1/quiz/:id | Get quiz for attempt (questions without answers) | @Roles('CUSTOMER') |
| POST | /api/v1/quiz/:id/submit | Submit answers, get score + points | @Roles('CUSTOMER') |
| GET | /api/v1/quiz/history | User's quiz attempt history | @Roles('CUSTOMER') |

### 10.2 Referral Endpoints (Customer-Facing)

Existing endpoints at `/api/v1/loyalty/referral` — enhance response shape as described in §6.2.4.

### 10.3 Fandom Profile Endpoint (Customer-Facing)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | /api/v1/loyalty/fandom-profile | Get current user's fandom profile | @Roles('CUSTOMER') |

Add to `loyalty.controller.ts`:

```typescript
@Get('fandom-profile')
async getFandomProfile(@CurrentUser() user: { id: string }): Promise<ApiResponse<unknown>> {
  const membership = await this.prisma.loyaltyMembership.findUnique({
    where: { userId: user.id },
    select: { fandomProfile: true },
  });
  return { data: membership?.fandomProfile ?? {}, message: 'OK' };
}
```

---

## 11. ADMIN API ENDPOINTS

### 11.1 Quiz Admin Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/v1/admin/quiz | List all quizzes |
| POST | /api/v1/admin/quiz | Create quiz |
| GET | /api/v1/admin/quiz/:id | Get quiz with stats |
| PUT | /api/v1/admin/quiz/:id | Update quiz |
| DELETE | /api/v1/admin/quiz/:id | Deactivate quiz |
| GET | /api/v1/admin/quiz/:id/attempts | View attempts for a quiz |

### 11.2 Fandom Profile Admin

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/v1/admin/loyalty/fandom-profiles/recompute | Trigger batch recompute |
| GET | /api/v1/admin/loyalty/members/:id/fandom-profile | View specific member's profile |

---

## 12. FRONTEND PAGES

### 12.1 New Pages

**Customer:**

| Path | Description |
|------|-------------|
| `apps/web/src/app/quiz/page.tsx` | Quiz listing page — browse by fandom, see available quizzes |
| `apps/web/src/app/quiz/[id]/page.tsx` | Quiz taking page — questions, submit, show results + points |
| `apps/web/src/app/ref/[code]/page.tsx` | Referral landing page — branded, sets cookie, CTA to register |

**Admin:**

| Path | Description |
|------|-------------|
| `apps/web/src/app/admin/quiz/page.tsx` | Quiz management — list, create, edit, view stats |

### 12.2 Enhanced Existing Pages

| Page | Enhancement |
|------|-------------|
| `apps/web/src/app/loyalty/page.tsx` | Add fandom profile radar chart / top fandoms display |
| `apps/web/src/app/loyalty/referral/page.tsx` | Enhanced stats: converted count, pending, total earned, recent referrals list |
| `apps/web/src/app/loyalty/rewards/page.tsx` | Add "Ways to earn" section showing all earn actions with points values |

### 12.3 New Components

| Component | Purpose |
|-----------|---------|
| `apps/web/src/components/loyalty/FandomRadar.tsx` | Radar/spider chart showing fandom affinity scores |
| `apps/web/src/components/loyalty/EarnActionsPanel.tsx` | Grid of earn actions (review, share, quiz, check-in) with points values |
| `apps/web/src/components/loyalty/ReferralStats.tsx` | Referral dashboard with stats and recent referral list |
| `apps/web/src/components/quiz/QuizCard.tsx` | Quiz listing card (fandom, difficulty, points, attempt count) |
| `apps/web/src/components/quiz/QuizPlayer.tsx` | Interactive quiz UI — question display, option selection, progress bar |
| `apps/web/src/components/quiz/QuizResults.tsx` | Post-quiz results — score, pass/fail, points awarded, correct answers |

### 12.4 UI Design Notes

- Quiz cards follow the existing HOS dark theme with fandom-colored accents
- Fandom radar chart uses a canvas-based or SVG spider diagram (lightweight, no heavy chart library needed)
- Referral share buttons include copy-to-clipboard, WhatsApp share, Twitter/X share, email share
- Quiz player uses a step-by-step layout (one question at a time) with progress indicator
- All pages use `font-primary` (Cinzel) for headings and `font-secondary` (Lora) for body text

---

## 13. API CLIENT EXTENSIONS

Add to `packages/api-client/src/client.ts`:

```typescript
// Quiz
async getQuizzes(fandomId?: string): Promise<ApiResponse<FandomQuiz[]>>
async getQuiz(quizId: string): Promise<ApiResponse<QuizPayload>>
async submitQuiz(quizId: string, answers: number[]): Promise<ApiResponse<QuizResult>>
async getQuizHistory(): Promise<ApiResponse<QuizAttempt[]>>

// Quiz Admin
async getAdminQuizzes(): Promise<ApiResponse<FandomQuiz[]>>
async createQuiz(data: CreateQuizDto): Promise<ApiResponse<FandomQuiz>>
async updateQuiz(quizId: string, data: Partial<CreateQuizDto>): Promise<ApiResponse<FandomQuiz>>
async deleteQuiz(quizId: string): Promise<ApiResponse<void>>
async getQuizAttempts(quizId: string): Promise<ApiResponse<QuizAttempt[]>>

// Fandom Profile
async getFandomProfile(): Promise<ApiResponse<Record<string, number>>>
async triggerFandomProfileRecompute(): Promise<ApiResponse<{ count: number }>>

// Enhanced Referral
async getLoyaltyReferralInfo(): Promise<ApiResponse<ReferralStatsResponse>>
```

---

## 14. ENVIRONMENT VARIABLES

Add to `services/api/src/config/env.validation.ts`:

```
QUIZ_MAX_PER_WEEK=1              # Max quiz attempts per user per week
QUIZ_PASS_THRESHOLD=0.5          # 50% correct to pass
FANDOM_PROFILE_RECOMPUTE_CRON=0 5 * * 0   # Weekly Sunday 5am UTC
```

These should have sensible defaults and should NOT be required.

---

## 15. TESTING STRATEGY

### 15.1 Unit Tests Required

| Test File | Tests | Min Count |
|-----------|-------|-----------|
| `loyalty/listeners/loyalty.listener.spec.ts` | onReviewSubmitted (with/without media), onSocialShare (daily limit), onQuestCompleted (idempotency), onQuizCompleted, onEventAttended | ≥ 8 |
| `quiz/quiz.service.spec.ts` | getAvailableQuizzes, submitQuiz (pass/fail), weekly limit enforcement, scoring accuracy | ≥ 6 |
| `loyalty/services/fandom-profile.service.spec.ts` | computeProfile (with purchase data, with wishlist, with empty data), normalization, batchUpdateProfiles | ≥ 5 |
| `loyalty/services/referral.service.spec.ts` | generateCode format, ensureReferralCode (new/existing), code uniqueness | ≥ 4 |
| `quiz/quiz.controller.spec.ts` | Endpoint validation, auth guard, error responses | ≥ 3 |

**Total minimum: ≥ 26 tests**

### 15.2 Integration Tests

- Full flow: user takes quiz → passes → points awarded → membership updated → tier recalculated
- Social share → daily limit enforced at 5 shares → 6th share silently skipped
- Review with photo → PHOTO_REVIEW points (50) awarded instead of REVIEW (25)
- Quest completion → loyalty points match quest.points value
- Referral landing → cookie set → registration with code → both parties credited
- Fandom profile: user with purchases across 3 fandoms → profile shows correct relative scores

### 15.3 Test Notes

- Mock `PrismaService` for all unit tests
- Quiz scoring tests should cover edge cases: 0 correct, all correct, exact threshold
- Frequency limit tests need time manipulation (`jest.useFakeTimers`)

---

## 16. MIGRATION & SEED SCRIPT

### 16.1 Migration

Use the idempotent SQL in §2.3. Apply via:

```bash
cd services/api
npx prisma db execute --file prisma/migrations/20260430100000_phase3_earn_fandom/migration.sql
npx prisma generate
```

### 16.2 Seed Script

Create `services/api/prisma/seeds/quiz-seed.ts`:

Seed sample quizzes for each major fandom:

| Fandom | Quiz Title | Questions | Difficulty | Points |
|--------|-----------|-----------|------------|--------|
| Harry Potter | "The Sorting Hat Challenge" | 10 | EASY | 25 |
| Harry Potter | "Advanced Potions Mastery" | 10 | HARD | 50 |
| Lord of the Rings | "Journey Through Middle-earth" | 8 | MEDIUM | 35 |
| Anime | "Ultimate Anime Knowledge" | 10 | MEDIUM | 35 |
| Marvel | "Avengers Assemble Quiz" | 8 | EASY | 25 |
| DC | "Gotham City Trivia" | 8 | EASY | 25 |

Each quiz should have well-crafted, accurate fandom questions with 4 options each.

Add script to `services/api/package.json`:

```json
"db:seed-quiz": "ts-node prisma/seeds/quiz-seed.ts"
```

---

## 17. ACCEPTANCE CRITERIA

| # | Criterion | How to Verify |
|---|-----------|---------------|
| 1 | Product review creation awards REVIEW (25) or PHOTO_REVIEW (50) loyalty points | Create a review, check transaction log |
| 2 | Social share awards SOCIAL_SHARE (10) points, max 5/day enforced | Share 6 times, verify 5th succeeds, 6th silently skips |
| 3 | Quest completion awards quest-specific loyalty points | Complete a quest, verify points match quest.points |
| 4 | Quiz system functional: create quiz, take quiz, score, award points | Admin creates quiz, customer takes it, points awarded on pass |
| 5 | Quiz weekly limit enforced | Take 2 quizzes in a week, verify second is rejected |
| 6 | Fandom profile computed from purchase history, wishlist, favorites, quizzes, quests | Check /loyalty/fandom-profile after purchases and quizzes |
| 7 | Fandom profile batch recompute runs via BullMQ cron (weekly) | Verify cron registration and manual trigger |
| 8 | Referral codes use branded format HOS-{NAME}-{RANDOM} | Generate code, verify format |
| 9 | Referral landing page sets attribution cookie | Visit /ref/{code}, check cookie |
| 10 | Referral conversion tracks convertedOrderId | Refer friend, friend orders, verify referral record |
| 11 | Gamification bridge: awardPoints() credits both legacy and Enchanted Circle | Call awardPoints, verify both User.loyaltyPoints and membership balance |
| 12 | Frequency limits enforced for all earn actions (maxPerDay, maxPerMonth) | Exceed limits, verify silent skip |
| 13 | All earn event listeners are idempotent | Trigger same event twice, verify single point credit |
| 14 | ≥ 26 unit tests passing | `npx jest --testPathPattern="(quiz|fandom-profile|loyalty.listener|referral)"` |
| 15 | TypeScript compiles with zero errors | `npx tsc --noEmit --skipLibCheck` |
| 16 | Prisma schema validates | `npx prisma validate` |

---

## FILE TREE (New / Modified)

```
services/api/
├── prisma/
│   ├── schema.prisma                                    # MODIFIED (FandomQuiz, FandomQuizAttempt)
│   ├── migrations/
│   │   └── 20260430100000_phase3_earn_fandom/
│   │       └── migration.sql                            # NEW
│   └── seeds/
│       └── quiz-seed.ts                                 # NEW
├── src/
│   ├── quiz/
│   │   ├── quiz.module.ts                               # NEW
│   │   ├── quiz.service.ts                              # NEW
│   │   ├── quiz.service.spec.ts                         # NEW
│   │   ├── quiz.controller.ts                           # NEW
│   │   ├── quiz.controller.spec.ts                      # NEW
│   │   ├── quiz-admin.controller.ts                     # NEW
│   │   └── dto/
│   │       ├── create-quiz.dto.ts                       # NEW
│   │       ├── submit-quiz.dto.ts                       # NEW
│   │       └── quiz-response.dto.ts                     # NEW
│   ├── loyalty/
│   │   ├── listeners/
│   │   │   ├── loyalty.listener.ts                      # MODIFIED (add onQuestCompleted, onQuizCompleted, onEventAttended, isWithinLimits)
│   │   │   └── loyalty.listener.spec.ts                 # NEW
│   │   ├── services/
│   │   │   ├── fandom-profile.service.ts                # NEW
│   │   │   ├── fandom-profile.service.spec.ts           # NEW
│   │   │   ├── referral.service.ts                      # MODIFIED (branded code format)
│   │   │   └── referral.service.spec.ts                 # NEW
│   │   ├── jobs/
│   │   │   └── loyalty.jobs.ts                          # MODIFIED (FANDOM_PROFILE_RECOMPUTE)
│   │   ├── loyalty.module.ts                            # MODIFIED (add FandomProfileService, QuizModule)
│   │   └── loyalty.controller.ts                        # MODIFIED (add fandom-profile endpoint)
│   ├── gamification/
│   │   ├── gamification.service.ts                      # MODIFIED (loyalty bridge + quest completion)
│   │   └── gamification.module.ts                       # MODIFIED (add LoyaltyModule import)
│   ├── social-sharing/
│   │   ├── social-sharing.service.ts                    # MODIFIED (call onSocialShare)
│   │   └── social-sharing.module.ts                     # MODIFIED (add LoyaltyModule import)
│   ├── products/
│   │   └── product-reviews.service.ts (or equivalent)   # MODIFIED (call onReviewSubmitted)
│   ├── queue/
│   │   └── queue.bullmq.impl.ts                         # MODIFIED (add FANDOM_PROFILE_RECOMPUTE job type)
│   ├── config/
│   │   └── env.validation.ts                            # MODIFIED (add Phase 3 env vars)
│   └── app.module.ts                                    # MODIFIED (add QuizModule)
├── package.json                                         # MODIFIED (add db:seed-quiz script)

apps/web/src/
├── app/
│   ├── quiz/
│   │   ├── page.tsx                                     # NEW — quiz listing
│   │   └── [id]/
│   │       └── page.tsx                                 # NEW — quiz player
│   ├── ref/
│   │   └── [code]/
│   │       └── page.tsx                                 # NEW — referral landing
│   ├── loyalty/
│   │   ├── page.tsx                                     # MODIFIED — add fandom profile display
│   │   └── referral/
│   │       └── page.tsx                                 # MODIFIED — enhanced referral stats
│   └── admin/
│       └── quiz/
│           └── page.tsx                                 # NEW — quiz admin
├── components/
│   ├── loyalty/
│   │   ├── FandomRadar.tsx                              # NEW
│   │   ├── EarnActionsPanel.tsx                         # NEW
│   │   └── ReferralStats.tsx                            # NEW
│   └── quiz/
│       ├── QuizCard.tsx                                 # NEW
│       ├── QuizPlayer.tsx                               # NEW
│       └── QuizResults.tsx                              # NEW

packages/api-client/src/
└── client.ts                                            # MODIFIED (quiz + fandom profile methods)
```

---

## BUILD ORDER (Sequential)

1. **Schema + Migration** — Add FandomQuiz/FandomQuizAttempt models, LoyaltyReferral additions, run migration, regenerate Prisma
2. **Loyalty Listener enhancements** — Add `isWithinLimits`, `onQuestCompleted`, `onQuizCompleted`, `onEventAttended`; enhance `onReviewSubmitted` for PHOTO_REVIEW detection
3. **Wire earn events** — Connect social-sharing, product-reviews, gamification to loyalty listener
4. **Gamification bridge** — Update `awardPoints()` to credit Enchanted Circle wallet
5. **Quiz system** — Module, service, controller, admin controller, DTOs
6. **Fandom Profile Service** — Compute, update, batch recompute
7. **Referral enhancements** — Branded codes, conversion tracking, enhanced API response
8. **BullMQ jobs** — FANDOM_PROFILE_RECOMPUTE cron
9. **API Client** — Add all new methods
10. **Frontend pages** — Quiz listing/player, referral landing, fandom profile display, admin quiz page
11. **Unit tests** — All spec files (≥ 26 tests)
12. **Environment variables** — Update env.validation.ts
13. **Seed script** — Quiz seed with sample quizzes
14. **Build verification** — `npx tsc --noEmit && npx jest`

---

**End of Phase 3 Build Spec**
