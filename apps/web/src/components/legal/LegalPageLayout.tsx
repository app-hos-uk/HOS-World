import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { sanitizeBlogHtml } from '@/lib/sanitizeHtml';

type LegalPageLayoutProps = {
  title: string;
  contentHtml: string;
  lastUpdated?: string;
};

export function LegalPageLayout({ title, contentHtml, lastUpdated }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-hos-bg-secondary">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12 max-w-4xl">
        <div className="prose prose-purple max-w-none text-hos-text-secondary cms-page-content">
          <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-hos-text">{title}</h1>
          {lastUpdated ? (
            <p className="text-sm text-hos-text-muted mb-8">Last updated: {lastUpdated}</p>
          ) : null}
          <div dangerouslySetInnerHTML={{ __html: sanitizeBlogHtml(contentHtml) }} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
