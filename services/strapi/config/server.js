module.exports = ({ env }) => {
  const appKeys = env.array('APP_KEYS');
  if ((!appKeys || appKeys.length === 0) && process.env.NODE_ENV === 'production') {
    throw new Error('APP_KEYS environment variable is required in production');
  }

  return {
    host: env('HOST', '0.0.0.0'),
    port: env.int('PORT', 1337),
    url: env('PUBLIC_URL', ''),
    app: {
      keys: appKeys?.length ? appKeys : ['dev-key1-change-me', 'dev-key2-change-me'],
    },
    webhooks: {
      populateRelations: env.bool('WEBHOOKS_POPULATE_RELATIONS', false),
    },
  };
};
