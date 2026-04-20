import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { UserRole } from '@prisma/client';

export type RuleOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty'
  | 'between'
  | 'days_ago_lt'
  | 'days_ago_gt';

export interface SegmentRule {
  dimension: string;
  operator: RuleOperator;
  value: unknown;
}

export interface SegmentRuleGroup {
  operator: 'AND' | 'OR';
  rules: SegmentRule[];
  groups?: SegmentRuleGroup[];
}

export const SEGMENT_DIMENSIONS: Record<
  string,
  { operators: RuleOperator[]; valueHint?: string }
> = {
  'tier.slug': { operators: ['eq', 'neq', 'in', 'not_in'] },
  'tier.level': { operators: ['eq', 'gt', 'gte', 'lt', 'lte', 'between'] },
  'points.balance': { operators: ['gt', 'gte', 'lt', 'lte', 'between', 'eq'] },
  'points.lifetime': { operators: ['gt', 'gte', 'lt', 'lte', 'between', 'eq'] },
  'spend.total': { operators: ['gt', 'gte', 'lt', 'lte', 'between', 'eq'] },
  'purchase.count': { operators: ['gt', 'gte', 'lt', 'lte', 'between', 'eq'] },
  'engagement.count': { operators: ['gt', 'gte', 'lt', 'lte', 'between', 'eq'] },
  'composite.score': { operators: ['gt', 'gte', 'lt', 'lte', 'between', 'eq'] },
  'activity.lastAt': { operators: ['days_ago_lt', 'days_ago_gt'] },
  'activity.enrolledAt': { operators: ['days_ago_lt', 'days_ago_gt', 'gt', 'lt', 'gte', 'lte'] },
  'activity.lastLogin': { operators: ['days_ago_lt', 'days_ago_gt'] },
  'geo.country': { operators: ['eq', 'neq', 'in', 'not_in'] },
  'geo.regionCode': { operators: ['eq', 'neq', 'in', 'not_in'] },
  'geo.city': { operators: ['eq', 'in'] },
  'fandom.favorites': { operators: ['contains', 'not_contains', 'is_empty', 'is_not_empty'] },
  'fandom.affinity': { operators: ['gt', 'gte', 'lt', 'lte'] },
  'user.role': { operators: ['eq', 'in'] },
  'user.birthday': { operators: ['is_empty', 'is_not_empty'] },
  'user.customerGroup': { operators: ['eq', 'in', 'is_empty'] },
  'enrollment.channel': { operators: ['eq', 'in'] },
  'comms.optInEmail': { operators: ['eq'] },
  'comms.optInSms': { operators: ['eq'] },
  'comms.optInWhatsApp': { operators: ['eq'] },
  'comms.optInPush': { operators: ['eq'] },
  'events.attendanceCount': { operators: ['gt', 'gte', 'lt', 'lte', 'eq'] },
  'events.hasAttended': { operators: ['eq'] },
  'quiz.completedCount': { operators: ['gt', 'gte', 'lt', 'lte', 'eq'] },
  'ambassador.status': { operators: ['eq', 'in'] },
  'ambassador.tier': { operators: ['eq', 'in'] },
  'ambassador.referralSignups': { operators: ['gt', 'gte', 'lt', 'lte', 'between'] },
  'ambassador.ugcApproved': { operators: ['gt', 'gte', 'lt', 'lte', 'between'] },
  'ambassador.isAmbassador': { operators: ['eq'] },
  'brand.activeCampaignCount': { operators: ['gt', 'gte', 'lt', 'lte', 'eq'] },
  'brand.hasRedeemed': { operators: ['eq'] },
};

function subDays(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function applyOp(
  op: RuleOperator,
  value: unknown,
): string | Prisma.StringFilter<'User'> | Prisma.StringNullableFilter<'User'> {
  switch (op) {
    case 'eq':
      return value as string;
    case 'neq':
      return { not: value as string };
    case 'in':
      if (!Array.isArray(value)) throw new BadRequestException('in operator requires array value');
      return { in: value as string[] };
    case 'not_in':
      if (!Array.isArray(value)) throw new BadRequestException('not_in operator requires array value');
      return { notIn: value as string[] };
    default:
      throw new BadRequestException(`Operator ${op} not valid for string field`);
  }
}

function applyNumericOp(
  op: RuleOperator,
  value: unknown,
): number | Prisma.IntFilter | Prisma.DecimalFilter | Prisma.DecimalNullableFilter {
  if (op === 'between') {
    if (!Array.isArray(value) || value.length !== 2) {
      throw new BadRequestException('between requires [min, max]');
    }
    const [a, b] = value as [number, number];
    return { gte: a, lte: b };
  }
  const n = Number(value);
  if (Number.isNaN(n)) throw new BadRequestException('Numeric rule value required');
  switch (op) {
    case 'eq':
      return n;
    case 'gt':
      return { gt: n };
    case 'gte':
      return { gte: n };
    case 'lt':
      return { lt: n };
    case 'lte':
      return { lte: n };
    default:
      throw new BadRequestException(`Operator ${op} not valid for numeric field`);
  }
}

function applyDaysAgoOp(
  field: 'lastActivityAt' | 'enrolledAt' | 'lastLoginAt',
  op: RuleOperator,
  days: number,
  opts?: { treatNullAsOld?: boolean },
): Prisma.DateTimeNullableFilter | Prisma.DateTimeFilter {
  const threshold = subDays(days);
  if (op === 'days_ago_lt') {
    return { gt: threshold };
  }
  if (op === 'days_ago_gt') {
    if (opts?.treatNullAsOld) {
      return {
        OR: [{ lt: threshold }, { equals: null }],
      } as unknown as Prisma.DateTimeNullableFilter;
    }
    return { lt: threshold };
  }
  throw new BadRequestException(`Operator ${op} not valid for relative date`);
}

function applyArrayFavoritesOp(
  operator: RuleOperator,
  value: unknown,
): Prisma.UserWhereInput {
  switch (operator) {
    case 'contains':
      return { favoriteFandoms: { has: String(value) } };
    case 'not_contains':
      return { NOT: { favoriteFandoms: { has: String(value) } } };
    case 'is_empty':
      return { favoriteFandoms: { equals: [] } };
    case 'is_not_empty':
      return { NOT: { favoriteFandoms: { equals: [] } } };
    default:
      throw new BadRequestException(`Operator ${operator} not valid for fandom.favorites`);
  }
}

export type CountRule =
  | { dimension: 'events.attendanceCount'; operator: RuleOperator; value: number }
  | { dimension: 'quiz.completedCount'; operator: RuleOperator; value: number }
  | { dimension: 'brand.activeCampaignCount'; operator: RuleOperator; value: number };

/** Pulls relation-count rules (not expressible as Prisma UserWhereInput in v6) for post-filtering. */
export function extractCountRules(group: SegmentRuleGroup): CountRule[] {
  const out: CountRule[] = [];
  for (const r of group.rules) {
    if (
      r.dimension === 'events.attendanceCount' ||
      r.dimension === 'quiz.completedCount' ||
      r.dimension === 'brand.activeCampaignCount'
    ) {
      out.push({
        dimension: r.dimension,
        operator: r.operator,
        value: Number(r.value),
      });
    }
  }
  for (const g of group.groups ?? []) {
    out.push(...extractCountRules(g));
  }
  return out;
}

/** Removes count dimensions so the remainder can be translated to Prisma. */
export function stripCountRulesFromGroup(group: SegmentRuleGroup): SegmentRuleGroup {
  const rules = group.rules.filter(
    (r) =>
      r.dimension !== 'events.attendanceCount' &&
      r.dimension !== 'quiz.completedCount' &&
      r.dimension !== 'brand.activeCampaignCount',
  );
  const groups = (group.groups ?? []).map(stripCountRulesFromGroup).filter(nonEmptyGroup);
  return { operator: group.operator, rules, groups: groups.length ? groups : undefined };
}

function nonEmptyGroup(g: SegmentRuleGroup): boolean {
  return (g.rules?.length ?? 0) > 0 || (g.groups?.length ?? 0) > 0;
}

export function countRuleMatches(
  counts: { eventAttendances: number; quizAttempts: number; brandRedemptions: number },
  rule: CountRule,
): boolean {
  const n =
    rule.dimension === 'events.attendanceCount'
      ? counts.eventAttendances
      : rule.dimension === 'quiz.completedCount'
        ? counts.quizAttempts
        : counts.brandRedemptions;
  const v = rule.value;
  switch (rule.operator) {
    case 'eq':
      return n === v;
    case 'gt':
      return n > v;
    case 'gte':
      return n >= v;
    case 'lt':
      return n < v;
    case 'lte':
      return n <= v;
    default:
      return false;
  }
}

function dimensionToWhere(rule: SegmentRule): Prisma.UserWhereInput {
  const { dimension, operator, value } = rule;

  switch (dimension) {
    case 'tier.slug':
      if (operator === 'in' || operator === 'not_in') {
        const f = applyOp(operator, value) as Prisma.StringFilter;
        return { loyaltyMembership: { tier: { slug: f } } };
      }
      return { loyaltyMembership: { tier: { slug: applyOp(operator, value) as string } } };
    case 'tier.level':
      return { loyaltyMembership: { tier: { level: applyNumericOp(operator, value) as Prisma.IntFilter } } };
    case 'points.balance':
      return {
        loyaltyMembership: { currentBalance: applyNumericOp(operator, value) as Prisma.IntFilter },
      };
    case 'points.lifetime':
      return {
        loyaltyMembership: { totalPointsEarned: applyNumericOp(operator, value) as Prisma.IntFilter },
      };
    case 'spend.total':
      return {
        loyaltyMembership: { totalSpend: applyNumericOp(operator, value) as Prisma.DecimalFilter },
      };
    case 'purchase.count':
      return {
        loyaltyMembership: { purchaseCount: applyNumericOp(operator, value) as Prisma.IntFilter },
      };
    case 'engagement.count':
      return {
        loyaltyMembership: { engagementCount: applyNumericOp(operator, value) as Prisma.IntFilter },
      };
    case 'composite.score':
      return {
        loyaltyMembership: { compositeScore: applyNumericOp(operator, value) as Prisma.DecimalFilter },
      };
    case 'activity.lastAt': {
      const days = value as number;
      const threshold = subDays(days);
      if (operator === 'days_ago_gt') {
        return {
          loyaltyMembership: {
            OR: [{ lastActivityAt: null }, { lastActivityAt: { lt: threshold } }],
          },
        };
      }
      if (operator === 'days_ago_lt') {
        return {
          loyaltyMembership: {
            lastActivityAt: { gt: threshold },
          },
        };
      }
      throw new BadRequestException(`Operator ${operator} not valid for activity.lastAt`);
    }
    case 'activity.enrolledAt': {
      if (operator === 'days_ago_lt' || operator === 'days_ago_gt') {
        return {
          loyaltyMembership: {
            enrolledAt: applyDaysAgoOp('enrolledAt', operator, value as number) as Prisma.DateTimeFilter,
          },
        };
      }
      const d = new Date(String(value));
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('activity.enrolledAt comparison requires a date value');
      }
      switch (operator) {
        case 'gt':
          return { loyaltyMembership: { enrolledAt: { gt: d } } };
        case 'lt':
          return { loyaltyMembership: { enrolledAt: { lt: d } } };
        case 'gte':
          return { loyaltyMembership: { enrolledAt: { gte: d } } };
        case 'lte':
          return { loyaltyMembership: { enrolledAt: { lte: d } } };
        default:
          throw new BadRequestException(`Operator ${operator} not valid for activity.enrolledAt`);
      }
    }
    case 'activity.lastLogin':
      return { lastLoginAt: applyDaysAgoOp('lastLoginAt', operator, value as number) };
    case 'geo.country':
      return { country: applyOp(operator, value) as Prisma.StringNullableFilter<'User'> };
    case 'geo.regionCode':
      return {
        loyaltyMembership: { regionCode: applyOp(operator, value) as Prisma.StringFilter },
      };
    case 'geo.city': {
      if (operator === 'in') {
        if (!Array.isArray(value)) throw new BadRequestException('geo.city in requires array');
        return {
          addresses: { some: { isDefault: true, city: { in: value as string[] } } },
        };
      }
      return {
        addresses: { some: { isDefault: true, city: applyOp('eq', value) as string } },
      };
    }
    case 'fandom.favorites':
      return applyArrayFavoritesOp(operator, value);
    case 'fandom.affinity': {
      const v = value as { fandom?: string; score?: number };
      if (!v?.fandom || v.score == null) {
        throw new BadRequestException('fandom.affinity value must be { fandom, score }');
      }
      return {
        loyaltyMembership: {
          fandomProfile: {
            path: [v.fandom],
            gte: v.score,
          } as Prisma.JsonNullableFilter,
        },
      };
    }
    case 'user.role':
      if (operator === 'in') {
        if (!Array.isArray(value)) throw new BadRequestException('user.role in requires array');
        return { role: { in: value as UserRole[] } };
      }
      return { role: value as UserRole };
    case 'user.birthday':
      if (operator === 'is_empty') {
        return {
          AND: [{ birthday: null }, { loyaltyMembership: { is: { birthday: null } } }],
        };
      }
      return {
        OR: [{ birthday: { not: null } }, { loyaltyMembership: { birthday: { not: null } } }],
      };
    case 'user.customerGroup':
      if (operator === 'is_empty') {
        return { customerGroupId: null };
      }
      if (operator === 'in') {
        if (!Array.isArray(value)) throw new BadRequestException('user.customerGroup in requires array');
        return { customerGroupId: { in: value as string[] } };
      }
      return { customerGroupId: value as string };
    case 'enrollment.channel':
      if (operator === 'in') {
        if (!Array.isArray(value)) throw new BadRequestException('enrollment.channel in requires array');
        return { loyaltyMembership: { enrollmentChannel: { in: value as string[] } } };
      }
      return { loyaltyMembership: { enrollmentChannel: applyOp('eq', value) as string } };
    case 'comms.optInEmail':
      return { loyaltyMembership: { optInEmail: Boolean(value) } };
    case 'comms.optInSms':
      return { loyaltyMembership: { optInSms: Boolean(value) } };
    case 'comms.optInWhatsApp':
      return { loyaltyMembership: { optInWhatsApp: Boolean(value) } };
    case 'comms.optInPush':
      return { loyaltyMembership: { optInPush: Boolean(value) } };
    case 'events.attendanceCount':
    case 'quiz.completedCount':
    case 'brand.activeCampaignCount':
      throw new BadRequestException(
        `${dimension} is handled via post-filter — use stripCountRulesFromGroup + extractCountRules`,
      );
    case 'events.hasAttended':
      return Boolean(value)
        ? { eventAttendances: { some: {} } }
        : { eventAttendances: { none: {} } };
    case 'ambassador.status':
      if (operator === 'in') {
        if (!Array.isArray(value)) throw new BadRequestException('ambassador.status in requires array');
        return { ambassadorProfile: { status: { in: value as string[] } } };
      }
      return { ambassadorProfile: { status: applyOp(operator, value) as string } };
    case 'ambassador.tier':
      if (operator === 'in') {
        if (!Array.isArray(value)) throw new BadRequestException('ambassador.tier in requires array');
        return { ambassadorProfile: { tier: { in: value as string[] } } };
      }
      return { ambassadorProfile: { tier: applyOp(operator, value) as string } };
    case 'ambassador.referralSignups':
      return {
        ambassadorProfile: {
          totalReferralSignups: applyNumericOp(operator, value) as Prisma.IntFilter,
        },
      };
    case 'ambassador.ugcApproved':
      return {
        ambassadorProfile: {
          totalUgcApproved: applyNumericOp(operator, value) as Prisma.IntFilter,
        },
      };
    case 'ambassador.isAmbassador':
      if (operator !== 'eq') {
        throw new BadRequestException('ambassador.isAmbassador supports eq only');
      }
      return Boolean(value)
        ? { ambassadorProfile: { isNot: null } }
        : { ambassadorProfile: { is: null } };
    case 'brand.hasRedeemed':
      if (operator !== 'eq') {
        throw new BadRequestException('brand.hasRedeemed supports eq only');
      }
      return Boolean(value)
        ? { brandCampaignRedemptions: { some: {} } }
        : { brandCampaignRedemptions: { none: {} } };
    default:
      throw new BadRequestException(`Unknown segment dimension: ${dimension}`);
  }
}

export function buildWhereClause(group: SegmentRuleGroup): Prisma.UserWhereInput {
  const conditions: Prisma.UserWhereInput[] = [];

  for (const rule of group.rules) {
    conditions.push(dimensionToWhere(rule));
  }

  for (const sub of group.groups ?? []) {
    conditions.push(buildWhereClause(sub));
  }

  if (conditions.length === 0) {
    return {};
  }

  if (group.operator === 'AND') {
    return { AND: conditions };
  }
  return { OR: conditions };
}

/** Prisma filter for segment rules (relation-count dimensions stripped; apply post-filter separately). */
export function buildSegmentUserWhere(rules: SegmentRuleGroup): Prisma.UserWhereInput {
  const stripped = stripCountRulesFromGroup(rules);
  const base: Prisma.UserWhereInput = {
    role: UserRole.CUSTOMER,
    isActive: true,
    loyaltyMembership: { isNot: null },
  };
  const inner = buildWhereClause(stripped);
  const keys = inner && typeof inner === 'object' ? Object.keys(inner) : [];
  if (!keys.length) {
    return base;
  }
  return { AND: [base, inner] };
}

function groupContainsCountRule(group: SegmentRuleGroup): boolean {
  for (const r of group.rules) {
    if (
      r.dimension === 'events.attendanceCount' ||
      r.dimension === 'quiz.completedCount' ||
      r.dimension === 'brand.activeCampaignCount'
    )
      return true;
  }
  for (const g of group.groups ?? []) {
    if (groupContainsCountRule(g)) return true;
  }
  return false;
}

/** Relation-count post-filter is only correct when no OR subtree contains a count rule. */
export function assertSafeCountComposition(group: SegmentRuleGroup): void {
  for (const g of group.groups ?? []) {
    assertSafeCountComposition(g);
  }
  if (group.operator === 'OR' && groupContainsCountRule(group)) {
    throw new BadRequestException(
      'events.attendanceCount, quiz.completedCount, and brand.activeCampaignCount cannot be used inside OR groups',
    );
  }
}

export function validateRuleGroup(group: SegmentRuleGroup): void {
  for (const rule of group.rules) {
    const meta = SEGMENT_DIMENSIONS[rule.dimension];
    if (!meta) {
      throw new BadRequestException(`Unknown segment dimension: ${rule.dimension}`);
    }
    if (!meta.operators.includes(rule.operator)) {
      throw new BadRequestException(
        `Invalid operator "${rule.operator}" for dimension "${rule.dimension}"`,
      );
    }
  }
  for (const g of group.groups ?? []) {
    validateRuleGroup(g);
  }
}
