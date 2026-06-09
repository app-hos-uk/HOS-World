interface BlogStructuredDataProps {
  post: {
    title: string;
    slug: string;
    excerpt: string;
    author: string;
    publishedAt?: string | null;
    updatedAt?: string | null;
    coverImage?: string | null;
    seoTitle?: string | null;
    metaDescription?: string | null;
    readingTime?: number | null;
  };
  siteUrl: string;
}

export function BlogStructuredData({ post, siteUrl }: BlogStructuredDataProps) {
  const url = `${siteUrl}/blog/${post.slug}`;
  const image = post.coverImage || `${siteUrl}/og-image.png`;

  const blogPosting = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.seoTitle || post.title,
    description: post.metaDescription || post.excerpt,
    author: { '@type': 'Person', name: post.author },
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    image,
    url,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    ...(post.readingTime ? { timeRequired: `PT${post.readingTime}M` } : {}),
  };

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: url },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(blogPosting) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
    </>
  );
}
