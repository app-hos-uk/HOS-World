import { getCMSPage } from '@/lib/cms';
import { LegalPageLayout } from '@/components/legal/LegalPageLayout';
import { formatDate } from '@/lib/datetime';

type ResolveLegalPageProps = {
  slug: string;
  fallbackTitle: string;
  children: React.ReactNode;
};

/** Prefer CMS page content when published; otherwise render static fallback. */
export async function ResolveLegalPage({ slug, fallbackTitle, children }: ResolveLegalPageProps) {
  const page = await getCMSPage(slug);
  if (page?.content?.trim()) {
    const lastUpdated = page.publishedAt
      ? formatDate(page.publishedAt, { year: 'numeric',
          month: 'long',
          day: 'numeric', })
      : undefined;
    return (
      <LegalPageLayout
        title={page.title || fallbackTitle}
        contentHtml={page.content}
        lastUpdated={lastUpdated}
      />
    );
  }
  return <>{children}</>;
}
