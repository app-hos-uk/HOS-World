import type { Metadata } from 'next';
import { LandingShell } from '../components/LandingShell';
import { LandingFooter } from '../components/LandingFooter';
import { landingPageMetadata } from '../lib/landingMetadata';
import { sanitizeCmsHtml } from '@/lib/sanitizeHtml';

export const metadata: Metadata = landingPageMetadata({
  title: 'Privacy Policy — House of Spells',
  description: 'Privacy Policy for House of Spells USA — Times Square, New York.',
  path: '/privacy',
});

const STRAPI_URL = process.env.NEXT_PUBLIC_STRAPI_URL?.trim() || '';


async function fetchPrivacyContent(): Promise<string | null> {
  if (!STRAPI_URL) return null;
  try {
    const res = await fetch(`${STRAPI_URL}/api/pages?filters[slug][$eq]=privacy-policy-usa&populate=*`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json?.data?.[0]?.attributes?.content || json?.data?.[0]?.content;
    return typeof content === 'string' ? sanitizeCmsHtml(content) : null;
  } catch {
    return null;
  }
}

export default async function PrivacyPage() {
  const cmsContent = await fetchPrivacyContent();

  return (
    <LandingShell nav="home" mainId="pg-privacy">
      <main id="pg-privacy" className="hos-page" tabIndex={-1}>
        <div className="privacy-container">
          <h1 className="privacy-title">Privacy Policy</h1>
          <p className="privacy-subtitle">House of Spells — United States</p>
          <div className="privacy-rule" />

          {cmsContent ? (
            <div className="privacy-body" dangerouslySetInnerHTML={{ __html: cmsContent }} />
          ) : (
            <div className="privacy-body">
              <p><strong>Effective Date:</strong> July 2026</p>

              <h2>1. Who We Are</h2>
              <p>
                House of Spells USA (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the website houseofspells.com and the
                House of Spells flagship store at Times Square, New York. We are committed to protecting your personal information
                and your right to privacy.
              </p>

              <h2>2. Information We Collect</h2>
              <p>We collect personal information that you voluntarily provide to us when you:</p>
              <ul>
                <li>Register as a Founding Member</li>
                <li>Create an account on our platform</li>
                <li>Make a purchase in-store or online</li>
                <li>Subscribe to our newsletter or communications</li>
                <li>Contact us with inquiries or feedback</li>
              </ul>
              <p>This information may include: name, email address, phone number, country, fandom preferences, and purchase history.</p>

              <h2>3. How We Use Your Information</h2>
              <p>We use your personal information to:</p>
              <ul>
                <li>Process and manage your Founding Member registration</li>
                <li>Send you updates about store launches, events, and exclusive offers</li>
                <li>Personalise your experience based on your fandom preferences</li>
                <li>Manage our loyalty programme (The Enchanted Circle)</li>
                <li>Process transactions and send related information</li>
                <li>Respond to your enquiries and provide customer support</li>
                <li>Improve our website, products, and services</li>
              </ul>

              <h2>4. Sharing Your Information</h2>
              <p>
                We do not sell your personal information. We may share your data with trusted service providers who assist us in
                operating our website, conducting our business, or servicing you, provided they agree to keep your information confidential.
              </p>

              <h2>5. Data Security</h2>
              <p>
                We implement appropriate technical and organisational measures to protect your personal information against
                unauthorised access, alteration, disclosure, or destruction.
              </p>

              <h2>6. Your Rights</h2>
              <p>Depending on your jurisdiction, you may have the right to:</p>
              <ul>
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your personal information</li>
                <li>Opt out of marketing communications at any time</li>
                <li>Lodge a complaint with a supervisory authority</li>
              </ul>

              <h2>7. Cookies</h2>
              <p>
                Our website may use cookies and similar tracking technologies to enhance your experience. You can manage your cookie
                preferences through your browser settings.
              </p>

              <h2>8. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy or wish to exercise your rights, please contact us at:{' '}
                <a href="mailto:privacy@houseofspells.com">privacy@houseofspells.com</a>
              </p>

              <h2>9. Changes to This Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date.
              </p>
            </div>
          )}
        </div>
        <LandingFooter />
      </main>
    </LandingShell>
  );
}
