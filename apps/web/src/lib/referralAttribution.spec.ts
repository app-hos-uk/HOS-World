import { programReferralSignupHref } from './referralAttribution';

describe('programReferralSignupHref', () => {
  it('sends every partner/loyalty flyer to the fandom-gated register form', () => {
    expect(programReferralSignupHref('PARTNER-DALLASBBQ-DALLASBBQ-C263')).toBe(
      '/login?register=1&ref=PARTNER-DALLASBBQ-DALLASBBQ-C263',
    );
  });
});
