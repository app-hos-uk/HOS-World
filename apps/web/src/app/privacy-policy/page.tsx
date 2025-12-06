'use client';

import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-4xl">
        <div className="prose prose-purple max-w-none">
          <h1 className="text-3xl sm:text-4xl font-bold mb-6">Privacy Policy</h1>
          <p className="text-sm text-gray-600 mb-8">
            Last updated: {new Date().toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="mb-4">
              House of Spells Marketplace (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you 
              use our marketplace platform.
            </p>
            <p>
              By using our service, you agree to the collection and use of information in accordance with this policy. 
              We comply with the General Data Protection Regulation (GDPR) and other applicable data protection laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            <h3 className="text-xl font-semibold mb-3">2.1 Personal Information</h3>
            <p className="mb-4">We collect information that you provide directly to us, including:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>Name, email address, and contact information</li>
              <li>Country and location information</li>
              <li>Phone number and WhatsApp number (if provided)</li>
              <li>Preferred communication method</li>
              <li>Payment and billing information</li>
              <li>Shipping addresses</li>
              <li>Account preferences and settings</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3">2.2 Automatically Collected Information</h3>
            <p className="mb-4">We automatically collect certain information when you use our service:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>IP address and geolocation data</li>
              <li>Browser type and version</li>
              <li>Device information</li>
              <li>Usage data and analytics</li>
              <li>Cookies and similar tracking technologies</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <p className="mb-4">We use the collected information for various purposes:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>To provide, maintain, and improve our services</li>
              <li>To process transactions and manage orders</li>
              <li>To communicate with you about your account and orders</li>
              <li>To send marketing communications (with your consent)</li>
              <li>To personalize your experience</li>
              <li>To detect and prevent fraud</li>
              <li>To comply with legal obligations</li>
              <li>To analyze usage patterns and improve our platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">4. Cookies and Tracking Technologies</h2>
            <p className="mb-4">
              We use cookies and similar tracking technologies to track activity on our service and hold certain information.
            </p>
            <h3 className="text-xl font-semibold mb-3">4.1 Types of Cookies</h3>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Essential Cookies:</strong> Required for the website to function. These cannot be disabled.
              </li>
              <li>
                <strong>Marketing Cookies:</strong> Used to deliver personalized advertisements and track campaign performance. 
                These require your consent.
              </li>
              <li>
                <strong>Analytics Cookies:</strong> Help us understand how visitors interact with our website. 
                These require your consent.
              </li>
            </ul>
            <p>
              You can manage your cookie preferences at any time through your account settings or the cookie banner.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
            <p className="mb-4">We may share your information in the following circumstances:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>With sellers when you place an order (order details only)</li>
              <li>With payment processors to process transactions</li>
              <li>With shipping providers to fulfill orders</li>
              <li>With service providers who assist in our operations</li>
              <li>When required by law or to protect our rights</li>
              <li>In connection with a business transfer or merger</li>
            </ul>
            <p>
              We do not sell your personal information to third parties for their marketing purposes.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">6. Your Rights (GDPR)</h2>
            <p className="mb-4">Under GDPR, you have the following rights:</p>
            <ul className="list-disc pl-6 mb-4 space-y-2">
              <li>
                <strong>Right to Access (Article 15):</strong> Request a copy of your personal data
              </li>
              <li>
                <strong>Right to Rectification (Article 16):</strong> Correct inaccurate or incomplete data
              </li>
              <li>
                <strong>Right to Erasure (Article 17):</strong> Request deletion of your personal data
              </li>
              <li>
                <strong>Right to Restrict Processing (Article 18):</strong> Limit how we use your data
              </li>
              <li>
                <strong>Right to Data Portability (Article 20):</strong> Receive your data in a structured format
              </li>
              <li>
                <strong>Right to Object (Article 21):</strong> Object to processing of your data
              </li>
              <li>
                <strong>Right to Withdraw Consent:</strong> Withdraw consent at any time
              </li>
            </ul>
            <p>
              You can exercise these rights through your account settings or by contacting us directly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">7. Data Security</h2>
            <p className="mb-4">
              We implement appropriate technical and organizational measures to protect your personal data against 
              unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over 
              the Internet is 100% secure.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">8. Data Retention</h2>
            <p className="mb-4">
              We retain your personal data only for as long as necessary to fulfill the purposes outlined in this 
              policy, unless a longer retention period is required or permitted by law. Order history may be retained 
              for legal and accounting purposes even after account deletion.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">9. International Data Transfers</h2>
            <p className="mb-4">
              Your information may be transferred to and processed in countries other than your country of residence. 
              We ensure appropriate safeguards are in place to protect your data in accordance with this Privacy Policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">10. Children's Privacy</h2>
            <p className="mb-4">
              Our service is not intended for children under 18 years of age. We do not knowingly collect personal 
              information from children. If you believe we have collected information from a child, please contact us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">11. Changes to This Privacy Policy</h2>
            <p className="mb-4">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the 
              new Privacy Policy on this page and updating the &quot;Last updated&quot; date.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
            <p className="mb-4">
              If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us:
            </p>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="mb-2"><strong>Email:</strong> privacy@houseofspells.co.uk</p>
              <p className="mb-2"><strong>Address:</strong> House of Spells Marketplace</p>
              <p><strong>Data Protection Officer:</strong> dpo@houseofspells.co.uk</p>
            </div>
          </section>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <Link
              href="/"
              className="text-purple-600 hover:text-purple-800 font-medium"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

