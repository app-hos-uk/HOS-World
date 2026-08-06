import { contrastRatio, DESIGN_TOKENS } from './contrast';

describe('design token contrast (WCAG AA guardrails)', () => {
  const {
    colorBgPrimary,
    colorBgSecondary,
    colorTextPrimary,
    colorTextSecondary,
    colorTextMuted,
    colorBorderInput,
    colorAccentGold,
    colorGoldCtaText,
  } = DESIGN_TOKENS;

  it('body primary text on page background meets 7:1', () => {
    expect(contrastRatio(colorTextPrimary, colorBgPrimary)).toBeGreaterThanOrEqual(7);
  });

  it('secondary body text on card background meets 7:1', () => {
    expect(contrastRatio(colorTextSecondary, colorBgSecondary)).toBeGreaterThanOrEqual(7);
  });

  it('muted / placeholder text on card background meets 4.5:1', () => {
    expect(contrastRatio(colorTextMuted, colorBgSecondary)).toBeGreaterThanOrEqual(4.5);
  });

  it('input border on card background meets 3:1 (WCAG 1.4.11)', () => {
    expect(contrastRatio(colorBorderInput, colorBgSecondary)).toBeGreaterThanOrEqual(3);
  });

  it('gold CTA text on gold button meets 4.5:1', () => {
    expect(contrastRatio(colorGoldCtaText, colorAccentGold)).toBeGreaterThanOrEqual(4.5);
  });

  it('primary input text is brighter than muted placeholder on same surface', () => {
    expect(relativeLuminanceRank(colorTextPrimary)).toBeGreaterThan(
      relativeLuminanceRank(colorTextMuted),
    );
  });
});

function relativeLuminanceRank(hex: string): number {
  // Use contrast vs black as a monotonic proxy for perceived brightness
  return contrastRatio(hex, '#000000');
}
