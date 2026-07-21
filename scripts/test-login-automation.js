/**
 * Browser Automation Test Script for Login Flow
 * Tests all team role users and dashboard access
 *
 * Requires TEST_SEED_PASSWORD env var (same as API seed scripts).
 */

const testPassword = process.env.TEST_SEED_PASSWORD?.trim();
if (!testPassword) {
  throw new Error('Set TEST_SEED_PASSWORD env var before running login automation tests.');
}

const testUsers = [
  {
    email: 'admin@hos.test',
    password: testPassword,
    role: 'ADMIN',
    expectedDashboard: '/admin/dashboard',
  },
  {
    email: 'procurement@hos.test',
    password: testPassword,
    role: 'PROCUREMENT',
    expectedDashboard: '/procurement/dashboard',
  },
  {
    email: 'fulfillment@hos.test',
    password: testPassword,
    role: 'FULFILLMENT',
    expectedDashboard: '/fulfillment/dashboard',
  },
  {
    email: 'catalog@hos.test',
    password: testPassword,
    role: 'CATALOG',
    expectedDashboard: '/catalog/dashboard',
  },
  {
    email: 'marketing@hos.test',
    password: testPassword,
    role: 'MARKETING',
    expectedDashboard: '/marketing/dashboard',
  },
  {
    email: 'finance@hos.test',
    password: testPassword,
    role: 'FINANCE',
    expectedDashboard: '/finance/dashboard',
  },
  {
    email: 'cms@hos.test',
    password: testPassword,
    role: 'CMS_EDITOR',
    expectedDashboard: '/',
  },
];

const baseUrl = process.env.FRONTEND_URL;
if (!baseUrl) {
  console.error('ERROR: Set FRONTEND_URL environment variable before running.');
  process.exit(1);
}

module.exports = {
  testUsers,
  baseUrl,
};
