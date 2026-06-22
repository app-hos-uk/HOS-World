import type { Metadata } from 'next';
import Link from 'next/link';
import { LandingShell } from '../components/LandingShell';
import { LandingFooter } from '../components/LandingFooter';
import { landingPageMetadata } from '../lib/landingMetadata';
import {
  getBlogPosts,
  getBlogCategories,
  getBanners,
  getStrapiMediaUrl,
} from '@/lib/strapi';

export const revalidate = 60;

export const metadata: Metadata = landingPageMetadata({
  title: 'Blog | House of Spells',
  description: 'Stories, guides, and news from the House of Spells fandom universe.',
  path: '/blog',
});

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string }>;
}) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;
  const category = params.category || undefined;

  const [postsResponse, categoriesResponse, bannersResponse] = await Promise.all([
    getBlogPosts({ page, pageSize: 12, category }),
    getBlogCategories(),
    getBanners('hero'),
  ]);

  const posts = postsResponse?.data || [];
  const categories = categoriesResponse?.data || [];
  const pagination = postsResponse?.meta?.pagination;
  const heroBanner = bannersResponse?.data?.[0];

  return (
    <LandingShell nav="blog" mainId="pg-blog">
      <main id="pg-blog" className="hos-page blog-page" tabIndex={-1}>
        <div className="page-hero rv">
          <p className="eyebrow">The Spellbook</p>
          <h1 className="sec-h2">
            Stories From
            <br />
            Every Universe
          </h1>
          <p className="sec-sub">
            Guides, news, and lore from the multi-fandom world of House of Spells.
          </p>
        </div>

        {heroBanner && (
          <section className="blog-banner rv">
            {heroBanner.attributes.link ? (
              <a href={heroBanner.attributes.link} className="blog-banner-link">
                <BannerContent banner={heroBanner} />
              </a>
            ) : (
              <BannerContent banner={heroBanner} />
            )}
          </section>
        )}

        {categories.length > 0 && (
          <nav className="blog-filters rv" aria-label="Blog categories">
            <Link href="/blog" className={`blog-filter${!category ? ' active' : ''}`}>
              All Posts
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/blog?category=${cat.attributes.slug}`}
                className={`blog-filter${category === cat.attributes.slug ? ' active' : ''}`}
              >
                {cat.attributes.name}
              </Link>
            ))}
          </nav>
        )}

        {posts.length === 0 ? (
          <div className="blog-empty rv">
            <p>No articles yet. Check back soon!</p>
          </div>
        ) : (
          <div className="blog-grid rv">
            {posts.map((post) => {
              const coverUrl = post.attributes.coverImage?.data?.attributes?.url;
              return (
                <article key={post.id} className="blog-card">
                  <Link href={`/blog/${post.attributes.slug}`} className="blog-card-link">
                    <div className="blog-card-media">
                      {coverUrl ? (
                        <img
                          src={getStrapiMediaUrl(coverUrl)}
                          alt={post.attributes.title}
                          loading="lazy"
                        />
                      ) : (
                        <div className="blog-card-placeholder" aria-hidden="true">
                          ✨
                        </div>
                      )}
                    </div>
                    <div className="blog-card-body">
                      {post.attributes.category?.data && (
                        <span className="blog-card-category">
                          {post.attributes.category.data.attributes.name}
                        </span>
                      )}
                      <h2 className="blog-card-title">{post.attributes.title}</h2>
                      <p className="blog-card-excerpt">{post.attributes.excerpt}</p>
                      <div className="blog-card-meta">
                        <time dateTime={post.attributes.publishedAt}>
                          {new Date(post.attributes.publishedAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </time>
                        {post.attributes.readingTime ? (
                          <span>{post.attributes.readingTime} min read</span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                </article>
              );
            })}
          </div>
        )}

        {pagination && pagination.pageCount > 1 && (
          <nav className="blog-pagination rv" aria-label="Blog pagination">
            {Array.from({ length: pagination.pageCount }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={`/blog?page=${p}${category ? `&category=${category}` : ''}`}
                className={`blog-page-link${p === page ? ' active' : ''}`}
              >
                {p}
              </Link>
            ))}
          </nav>
        )}

        <LandingFooter />
      </main>
    </LandingShell>
  );
}

function BannerContent({
  banner,
}: {
  banner: NonNullable<Awaited<ReturnType<typeof getBanners>>>['data'][number];
}) {
  const imageUrl = banner.attributes.image?.data?.attributes?.url;
  return (
    <div className="blog-banner-inner">
      {imageUrl && (
        <img
          src={getStrapiMediaUrl(imageUrl)}
          alt={banner.attributes.image?.data?.attributes?.alternativeText || banner.attributes.title}
          className="blog-banner-img"
        />
      )}
      <div className="blog-banner-overlay">
        <h2 className="blog-banner-title">{banner.attributes.title}</h2>
        {banner.attributes.content && (
          <div
            className="blog-banner-text"
            dangerouslySetInnerHTML={{ __html: banner.attributes.content }}
          />
        )}
      </div>
    </div>
  );
}
