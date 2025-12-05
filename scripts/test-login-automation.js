/**
 * Browser Automation Test Script for Login Flow
 * Tests all team role users and dashboard access
 * 
 * To run: This will be executed via browser automation tools
 */

const testUsers = [
  {
    email: 'admin@hos.test',
    password: 'Test123!',
    role: 'ADMIN',
    expectedDashboard: '/admin/dashboard',
  },
  {
    email: 'procurement@hos.test',
    password: 'Test123!',
    role: 'PROCUREMENT',
    expectedDashboard: '/procurement/dashboard',
  },
  {
    email: 'fulfillment@hos.test',
    password: 'Test123!',
    role: 'FULFILLMENT',
    expectedDashboard: '/fulfillment/dashboard',
  },
  {
    email: 'catalog@hos.test',
    password: 'Test123!',
    role: 'CATALOG',
    expectedDashboard: '/catalog/dashboard',
  },
  {
    email: 'marketing@hos.test',
    password: 'Test123!',
    role: 'MARKETING',
    expectedDashboard: '/marketing/dashboard',
  },
  {
    email: 'finance@hos.test',
    password: 'Test123!',
    role: 'FINANCE',
    expectedDashboard: '/finance/dashboard',
  },
  {
    email: 'cms@hos.test',
    password: 'Test123!',
    role: 'CMS_EDITOR',
    expectedDashboard: '/',
  },
];

const baseUrl = 'https://hos-marketplaceweb-production.up.railway.app';

module.exports = {
  testUsers,
  baseUrl,
};

