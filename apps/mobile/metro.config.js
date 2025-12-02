const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  '@hos-marketplace/shared-types': require.resolve('@hos-marketplace/shared-types'),
  '@hos-marketplace/api-client': require.resolve('@hos-marketplace/api-client'),
  '@hos-marketplace/theme-system': require.resolve('@hos-marketplace/theme-system'),
  '@hos-marketplace/utils': require.resolve('@hos-marketplace/utils'),
};

module.exports = config;


