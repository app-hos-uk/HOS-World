'use client';

interface SEOPanelProps {
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  slug: string;
  title: string;
  excerpt: string;
  onChange: (field: string, value: string) => void;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

export function SEOPanel({
  seoTitle,
  metaDescription,
  focusKeyword,
  canonicalUrl,
  slug,
  title,
  excerpt,
  onChange,
}: SEOPanelProps) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://houseofspells.com';
  const displayTitle = seoTitle || title || 'Blog Post Title';
  const displayDescription = metaDescription || excerpt || 'Add a meta description for search engines.';
  const displayUrl = `${siteUrl.replace(/\/$/, '')}/blog/${slug || 'your-post-slug'}`;

  const keywordChecks = focusKeyword
    ? [
        { label: 'In SEO title', ok: displayTitle.toLowerCase().includes(focusKeyword.toLowerCase()) },
        { label: 'In slug', ok: slug.toLowerCase().includes(focusKeyword.toLowerCase().replace(/\s+/g, '-')) },
        { label: 'In meta description', ok: displayDescription.toLowerCase().includes(focusKeyword.toLowerCase()) },
      ]
    : [];

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-hos-text-secondary">SEO Settings</h3>

      <div className="p-4 rounded-lg border border-hos-border bg-hos-bg-tertiary">
        <p className="text-xs text-hos-text-muted mb-2 uppercase tracking-wide">Google Preview</p>
        <p className="text-[#8ab4f8] text-lg leading-tight truncate">{truncate(displayTitle, 60)}</p>
        <p className="text-[#006621] text-sm mt-0.5 truncate">{displayUrl}</p>
        <p className="text-[#bdc1c6] text-sm mt-1 line-clamp-2">{truncate(displayDescription, 155)}</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-hos-text-secondary mb-1">
          SEO Title <span className="text-hos-text-muted">({displayTitle.length}/60)</span>
        </label>
        <input
          type="text"
          value={seoTitle}
          onChange={(e) => onChange('seoTitle', e.target.value)}
          className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:border-hos-gold"
          placeholder={title || 'Custom SEO title'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-hos-text-secondary mb-1">
          Meta Description <span className="text-hos-text-muted">({displayDescription.length}/155)</span>
        </label>
        <textarea
          value={metaDescription}
          onChange={(e) => onChange('metaDescription', e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:border-hos-gold"
          placeholder={excerpt || 'Custom meta description'}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Focus Keyword</label>
        <input
          type="text"
          value={focusKeyword}
          onChange={(e) => onChange('focusKeyword', e.target.value)}
          className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:border-hos-gold"
          placeholder="e.g. harry potter collectibles"
        />
        {keywordChecks.length > 0 && (
          <ul className="mt-2 space-y-1">
            {keywordChecks.map((check) => (
              <li key={check.label} className={`text-xs ${check.ok ? 'text-green-400' : 'text-yellow-400'}`}>
                {check.ok ? '✓' : '○'} {check.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-hos-text-secondary mb-1">Canonical URL</label>
        <input
          type="url"
          value={canonicalUrl}
          onChange={(e) => onChange('canonicalUrl', e.target.value)}
          className="w-full px-3 py-2 border border-hos-border rounded-lg bg-hos-bg-secondary text-hos-text-secondary focus:outline-none focus:border-hos-gold"
          placeholder="Leave empty to use default"
        />
      </div>
    </div>
  );
}
