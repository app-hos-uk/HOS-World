const config = {
  locales: ['en'],
  translations: {
    en: {
      'app.components.LeftMenu.navbrand.title': 'House of Spells CMS',
      'app.components.LeftMenu.navbrand.workplace': 'Content Management',
      'Auth.form.welcome.title': 'House of Spells CMS',
      'Auth.form.welcome.subtitle': 'Login to manage content',
    },
  },
};

const bootstrap = (app) => {
  console.log('House of Spells CMS initialized');
};

export default {
  config,
  bootstrap,
};
