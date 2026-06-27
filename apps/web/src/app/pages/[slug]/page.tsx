import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { getCMSPage } from '@/lib/cms';
import { sanitizeBlogHtml } from '@/lib/sanitizeHtml';

interface CmsContentPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CmsContentPageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCMSPage(slug);
  if (!page) return { title: 'Page Not Found' };

  return {
    title: page.seo?.metaTitle || page.title,
    description: page.seo?.metaDescription || undefined,
    keywords: page.seo?.keywords || undefined,
  };
}

export default async function CmsContentPage({ params }: CmsContentPageProps) {
  const { slug } = await params;
  const page = await getCMSPage(slug);
  if (!page) notFound();

  const html = sanitizeBlogHtml(page.content);

  return (
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-3xl">
        <nav className="mb-6 text-sm text-hos-text-muted">
          <Link href="/shop" className="hover:text-hos-gold transition-colors">
            Shop
          </Link>
          <span className="mx-2">/</span>
          <span className="text-hos-text-secondary">{page.title}</span>
        </nav>
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8 text-hos-text-primary">
          {page.title}
        </h1>
        <div
          className="prose prose-invert max-w-none text-hos-text-secondary cms-page-content"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </main>
      <Footer />
    </div>
  );
}
