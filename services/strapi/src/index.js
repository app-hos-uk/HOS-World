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
  bootstrap(/* { strapi } */) {},
  destroy(/* { strapi } */) {},
};
