import { UserRole } from '@prisma/client';
import {
  assertSafeCountComposition,
  buildSegmentUserWhere,
  buildWhereClause,
  countRuleMatches,
  extractCountRules,
  extractTouristRule,
  stripCountRulesFromGroup,
  validateRuleGroup,
  type SegmentRuleGroup,
} from './rule-evaluator';

describe('rule-evaluator', () => {
  it('buildWhereClause AND merges leaf rules', () => {
    const g: SegmentRuleGroup = {
      operator: 'AND',
      rules: [
        { dimension: 'tier.level', operator: 'gte', value: 4 },
        { dimension: 'geo.country', operator: 'eq', value: 'GB' },
      ],
    };
    const w = buildWhereClause(g);
    expect(w.AND).toHaveLength(2);
  });

  it('buildWhereClause OR', () => {
    const g: SegmentRuleGroup = {
      operator: 'OR',
      rules: [
        { dimension: 'geo.country', operator: 'eq', value: 'US' },
        { dimension: 'enrollment.channel', operator: 'eq', value: 'POS' },
      ],
    };
    const w = buildWhereClause(g);
    expect(w.OR).toHaveLength(2);
  });

  it('nested groups', () => {
    const g: SegmentRuleGroup = {
      operator: 'AND',
      rules: [{ dimension: 'tier.level', operator: 'gte', value: 4 }],
      groups: [
        {
          operator: 'OR',
          rules: [
            { dimension: 'geo.country', operator: 'eq', value: 'GB' },
            { dimension: 'geo.country', operator: 'eq', value: 'US' },
          ],
        },
      ],
    };
    const w = buildWhereClause(g);
    expect(w.AND).toHaveLength(2);
  });

  it('buildSegmentUserWhere adds base loyalty customer filter', () => {
    const g: SegmentRuleGroup = {
      operator: 'AND',
      rules: [{ dimension: 'points.balance', operator: 'gte', value: 10 }],
    };
    const w = buildSegmentUserWhere(g);
    expect(w.AND).toBeDefined();
    const and = w.AND as object[];
    expect(and[0]).toMatchObject({
      role: UserRole.CUSTOMER,
      isActive: true,
    });
  });

  it('fandom.favorites contains', () => {
    const w = buildWhereClause({
      operator: 'AND',
      rules: [{ dimension: 'fandom.favorites', operator: 'contains', value: 'harry-potter' }],
    });
    expect(w).toEqual({ AND: [{ favoriteFandoms: { has: 'harry-potter' } }] });
  });

  it('events.hasAttended false', () => {
    const w = buildWhereClause({
      operator: 'AND',
      rules: [{ dimension: 'events.hasAttended', operator: 'eq', value: false }],
    });
    expect(w).toEqual({ AND: [{ eventAttendances: { none: {} } }] });
  });

  it('activity.lastAt days_ago_gt includes null', () => {
    const w = buildWhereClause({
      operator: 'AND',
      rules: [{ dimension: 'activity.lastAt', operator: 'days_ago_gt', value: 30 }],
    });
    const leaf = (w as any).AND[0].loyaltyMembership;
    expect(leaf.OR).toHaveLength(2);
  });

  it('unknown dimension throws', () => {
    expect(() =>
      buildWhereClause({
        operator: 'AND',
        rules: [{ dimension: 'unknown.dim', operator: 'eq', value: 1 } as any],
      }),
    ).toThrow(/Unknown segment dimension/);
  });

  it('validateRuleGroup rejects bad operator', () => {
    expect(() =>
      validateRuleGroup({
        operator: 'AND',
        rules: [{ dimension: 'tier.level', operator: 'contains' as any, value: 1 }],
      }),
    ).toThrow(/Invalid operator/);
  });

  it('extractCountRules collects attendance and quiz', () => {
    const g: SegmentRuleGroup = {
      operator: 'AND',
      rules: [
        { dimension: 'events.attendanceCount', operator: 'gte', value: 3 },
        { dimension: 'quiz.completedCount', operator: 'gte', value: 1 },
      ],
    };
    const c = extractCountRules(g);
    expect(c).toHaveLength(2);
  });

  it('stripCountRulesFromGroup removes count dimensions', () => {
    const g: SegmentRuleGroup = {
      operator: 'AND',
      rules: [
        { dimension: 'tier.level', operator: 'gte', value: 2 },
        { dimension: 'events.attendanceCount', operator: 'gte', value: 3 },
      ],
    };
    const s = stripCountRulesFromGroup(g);
    expect(s.rules).toHaveLength(1);
  });

  it('assertSafeCountComposition rejects OR with count', () => {
    expect(() =>
      assertSafeCountComposition({
        operator: 'OR',
        rules: [{ dimension: 'events.attendanceCount', operator: 'gte', value: 1 }],
      }),
    ).toThrow(/cannot be used inside OR groups/);
  });

  it('ambassador.isAmbassador eq true', () => {
    const g: SegmentRuleGroup = {
      operator: 'AND',
      rules: [{ dimension: 'ambassador.isAmbassador', operator: 'eq', value: true }],
    };
    validateRuleGroup(g);
    const w = buildWhereClause(g);
    expect(w.AND?.[0]).toEqual({ ambassadorProfile: { isNot: null } });
  });

  it('extractCountRules includes brand.activeCampaignCount', () => {
    const g: SegmentRuleGroup = {
      operator: 'AND',
      rules: [{ dimension: 'brand.activeCampaignCount', operator: 'gte', value: 2 }],
    };
    const c = extractCountRules(g);
    expect(c).toEqual([
      { dimension: 'brand.activeCampaignCount', operator: 'gte', value: 2 },
    ]);
  });

  it('stripCountRulesFromGroup removes brand.activeCampaignCount', () => {
    const g: SegmentRuleGroup = {
      operator: 'AND',
      rules: [
        { dimension: 'tier.level', operator: 'gte', value: 1 },
        { dimension: 'brand.activeCampaignCount', operator: 'gte', value: 1 },
      ],
    };
    const s = stripCountRulesFromGroup(g);
    expect(s.rules).toHaveLength(1);
  });

  it('brand.hasRedeemed builds where', () => {
    const g: SegmentRuleGroup = {
      operator: 'AND',
      rules: [{ dimension: 'brand.hasRedeemed', operator: 'eq', value: true }],
    };
    validateRuleGroup(g);
    const w = buildWhereClause(g);
    expect(w.AND?.[0]).toEqual({ brandCampaignRedemptions: { some: {} } });
  });

  it('countRuleMatches brand.activeCampaignCount', () => {
    expect(
      countRuleMatches(
        { eventAttendances: 0, quizAttempts: 0, brandRedemptions: 3 },
        { dimension: 'brand.activeCampaignCount', operator: 'gte', value: 2 },
      ),
    ).toBe(true);
    expect(
      countRuleMatches(
        { eventAttendances: 0, quizAttempts: 0, brandRedemptions: 1 },
        { dimension: 'brand.activeCampaignCount', operator: 'eq', value: 2 },
      ),
    ).toBe(false);
  });

  it('extractTouristRule reads geo.isTourist', () => {
    const g: SegmentRuleGroup = {
      operator: 'AND',
      rules: [
        { dimension: 'tier.level', operator: 'gte', value: 1 },
        { dimension: 'geo.isTourist', operator: 'eq', value: true },
      ],
    };
    expect(extractTouristRule(g)).toBe(true);
    const stripped = stripCountRulesFromGroup(g);
    expect(stripped.rules.some((r) => r.dimension === 'geo.isTourist')).toBe(false);
  });
});
