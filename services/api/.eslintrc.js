/**
 * Currency / region migration guardrails.
 * Prefer no-restricted-syntax (AST selectors) over a custom plugin: the patterns
 * are expressible with esquery, and a plugin would be more machinery than value.
 */
const CURRENCY_CODE =
  'AED|AUD|BHD|CAD|CHF|CNY|EUR|GBP|HKD|INR|JPY|KRW|KWD|MXN|NZD|OMR|SAR|SGD|USD|ZAR';

const intlCurrencyLiteralRule = {
  selector:
    "CallExpression[callee.object.name='Intl'][callee.property.name='NumberFormat'] Property[key.name='currency'][value.type='Literal']",
  message:
    'Do not pass a literal currency code to Intl.NumberFormat. Use shared money helpers / PlatformRegionService.',
};

const currencyCodeLiteralRule = {
  selector: `Literal[value=/^(?:${CURRENCY_CODE})$/]`,
  message:
    "Do not hardcode currency codes ('USD', 'GBP', …). Import PLATFORM_DEFAULT_CURRENCY, use PlatformRegionService, or add to an allowlisted currency metadata module.",
};

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    // Not tsconfig.json: that excludes test/, which the lint script still globs.
    project: 'tsconfig.eslint.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      },
    ],
    'no-restricted-syntax': ['error', intlCurrencyLiteralRule, currencyCodeLiteralRule],
  },
  overrides: [
    {
      // Tests may fixture any currency. `test/**` also covers *.e2e-spec.ts and helpers,
      // which the *.spec.ts glob misses.
      files: ['**/*.{spec,test}.ts', 'test/**/*.ts'],
      rules: {
        'no-restricted-syntax': ['error', intlCurrencyLiteralRule],
      },
    },
    {
      // Source-of-truth defaults, ISO metadata maps, and Stripe minor-unit tables.
      files: [
        'src/common/currency-defaults.ts',
        'src/common/money.ts',
        'src/currency/currency.service.ts',
        'src/geolocation/geolocation.service.ts',
        'src/invoices/invoices.service.ts',
        'src/admin/migration.controller.ts',
      ],
      rules: {
        'no-restricted-syntax': ['error', intlCurrencyLiteralRule],
      },
    },
  ],
};
