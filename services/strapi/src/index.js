'use strict';

module.exports = {
  register({ strapi }) {
    strapi.server.routes([
      {
        method: 'GET',
        path: '/api/health/live',
        handler: (ctx) => {
          ctx.body = { status: 'ok' };
        },
        config: { auth: false },
      },
    ]);
  },

  async bootstrap({ strapi }) {
    // Set public permissions for content types (only runs if not already set)
    await setupPublicPermissions(strapi);
    // Seed a test blog post if none exist
    await seedTestContent(strapi);
  },

  destroy(/* { strapi } */) {},
};

async function setupPublicPermissions(strapi) {
  const publicRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (!publicRole) return;

  const existingPerms = await strapi
    .query('plugin::users-permissions.permission')
    .findMany({ where: { role: publicRole.id } });

  const existingActions = existingPerms.map((p) => p.action);

  const publicActions = [
    'api::blog-post.blog-post.find',
    'api::blog-post.blog-post.findOne',
    'api::blog-category.blog-category.find',
    'api::blog-category.blog-category.findOne',
    'api::page.page.find',
    'api::page.page.findOne',
    'api::banner.banner.find',
    'api::banner.banner.findOne',
  ];

  for (const action of publicActions) {
    if (!existingActions.includes(action)) {
      await strapi.query('plugin::users-permissions.permission').create({
        data: {
          action,
          role: publicRole.id,
        },
      });
      strapi.log.info(`Permission granted: ${action}`);
    }
  }
}

async function seedTestContent(strapi) {
  const postCount = await strapi.query('api::blog-post.blog-post').count();
  if (postCount > 0) return;

  // Create a category first
  let category = await strapi.query('api::blog-category.blog-category').findOne({
    where: { slug: 'news' },
  });

  if (!category) {
    category = await strapi.query('api::blog-category.blog-category').create({
      data: {
        name: 'News',
        slug: 'news',
        description: 'Latest news from House of Spells',
      },
    });
    strapi.log.info('Created blog category: News');
  }

  // Create a test blog post
  await strapi.query('api::blog-post.blog-post').create({
    data: {
      title: 'Welcome to House of Spells',
      slug: 'welcome-to-house-of-spells',
      excerpt: 'Discover the magic of multi-fandom retail at House of Spells — where every universe finds a home.',
      content: '<h2>A New Chapter Begins</h2><p>House of Spells is opening its doors to fans of every universe. From wizarding worlds to galactic empires, from superhero sagas to anime adventures — we are building the ultimate multi-fandom destination.</p><h2>What to Expect</h2><p>Our flagship location in Times Square, New York will feature immersive experiences, exclusive collectibles, and community events that bring fandoms together like never before.</p><p>Stay tuned for more updates as we reveal our plans for the grand opening!</p>',
      author: 'House of Spells Team',
      readingTime: 3,
      seoTitle: 'Welcome to House of Spells | Multi-Fandom Universe',
      metaDescription: 'Discover the magic of multi-fandom retail at House of Spells — the ultimate destination for fans of every universe.',
      focusKeyword: 'house of spells',
      category: category.id,
      publishedAt: new Date().toISOString(),
    },
  });
  strapi.log.info('Created test blog post: Welcome to House of Spells');
}
