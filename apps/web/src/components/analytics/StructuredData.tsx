import { getSiteUrl } from '@/lib/siteUrls';

const SITE_URL = getSiteUrl();

export function SiteStructuredData() {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'House of Spells',
    url: SITE_URL,
    logo: `${SITE_URL}/assets/logo-emblem.png`,
    sameAs: [
      process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK_URL,
      process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL,
      process.env.NEXT_PUBLIC_SOCIAL_X_URL ?? process.env.NEXT_PUBLIC_SOCIAL_TWITTER_URL,
    ].filter(Boolean),
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      email: 'info@houseofspells.com',
      availableLanguage: 'English',
    },
  };

  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'House of Spells',
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/products?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}

type ProductStructuredDataProps = {
  product: {
    id?: string;
    slug?: string;
    name?: string;
    description?: string;
    shortDescription?: string;
    price?: number;
    currency?: string;
    images?: Array<{ url?: string }>;
    averageRating?: number;
    reviewCount?: number;
    inStock?: boolean;
    stock?: number;
  };
  pathId: string;
};

export function ProductStructuredData({ product, pathId }: ProductStructuredDataProps) {
  const image = product.images?.[0]?.url;
  const description =
    product.shortDescription || product.description?.slice(0, 500) || product.name;

  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description,
    sku: product.id,
    url: `${SITE_URL}/products/${pathId}`,
    image: image ? [image] : undefined,
    offers: {
      '@type': 'Offer',
      price: product.price,
      priceCurrency: product.currency || 'USD',
      availability:
        product.inStock === false || product.stock === 0
          ? 'https://schema.org/OutOfStock'
          : 'https://schema.org/InStock',
      url: `${SITE_URL}/products/${pathId}`,
    },
  };

  if (product.averageRating && product.reviewCount) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: product.averageRating,
      reviewCount: product.reviewCount,
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
