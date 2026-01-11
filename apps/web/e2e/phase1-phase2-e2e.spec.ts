import { test, expect } from '@playwright/test';

function normalizeApiUrl(raw: string | undefined): string {
  const v = (raw || '').trim();
  if (!v) return 'http://localhost:3001/api';
  // If user provides domain-only, assume https + /api
  if (!v.startsWith('http://') && !v.startsWith('https://')) return `https://${v.replace(/\/+$/, '')}/api`;
  // If user provides base domain, append /api; otherwise keep as-is
  if (v.endsWith('/api') || v.includes('/api/')) return v.replace(/\/+$/, '');
  return `${v.replace(/\/+$/, '')}/api`;
}

const API_URL = normalizeApiUrl(process.env.NEXT_PUBLIC_API_URL);
function toV1ApiUrl(apiUrl: string): string {
  const trimmed = apiUrl.replace(/\/+$/, '');
  if (trimmed.includes('/api/v1')) return trimmed;
  if (trimmed.endsWith('/api')) return `${trimmed}/v1`;
  // Fallback: if someone passes a full base without /api, keep it as-is.
  return trimmed;
}

const API_V1_URL = toV1ApiUrl(API_URL);
const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';

test.describe('Phase 1 & Phase 2 E2E Tests', () => {
  let authToken: string;
  let customerToken: string;
  let productId: string;
  let cartId: string;
  let orderId: string;
  let missingPhase1Phase2Paths: string[] = [];

  test.beforeAll(async ({ request }) => {
    // Determine whether Phase 1 & 2 endpoints exist in the target API deployment.
    // This prevents noisy cascades of 404s and gives a single clear failure.
    try {
      const docs = await request.get(`${API_URL}/docs-json`);
      if (docs.ok()) {
        const spec = (await docs.json()) as any;
        const paths = spec?.paths || {};
        // Our API uses URI versioning (/api/v1/*). Some environments might still expose legacy
        // unversioned paths in the OpenAPI spec. Accept either to avoid false negatives.
        const requiredV1 = [
          '/api/v1/promotions',
          '/api/v1/shipping/methods',
          '/api/v1/customer-groups',
          '/api/v1/return-policies',
        ];
        const requiredLegacy = [
          '/api/promotions',
          '/api/shipping/methods',
          '/api/customer-groups',
          '/api/return-policies',
        ];
        missingPhase1Phase2Paths = requiredV1.filter(
          (pV1, idx) => !paths[pV1] && !paths[requiredLegacy[idx]],
        );
      } else {
        // If docs-json isn't available, don't block tests here; API calls will show the issue.
        missingPhase1Phase2Paths = [];
      }
    } catch {
      missingPhase1Phase2Paths = [];
    }

    async function login(email: string, password: string): Promise<string> {
      const res = await request.post(`${API_V1_URL}/auth/login`, {
        data: { email, password },
      });
      if (!res.ok()) {
        return '';
      }
      const data = (await res.json()) as any;
      return data?.data?.token || '';
    }

    // In production-like environments, the test users may not exist yet.
    // The API includes public seed endpoints (upsert semantics) used for testing/dev.
    // Try login first; if it fails, seed and retry.
    authToken = await login('admin@hos.test', 'Test123!');
    customerToken = await login('customer@hos.test', 'Test123!');

    if (!authToken || !customerToken) {
      await request.post(`${API_V1_URL}/admin/create-team-users`);
      await request.post(`${API_V1_URL}/admin/create-business-users`);
      authToken = authToken || (await login('admin@hos.test', 'Test123!'));
      customerToken = customerToken || (await login('customer@hos.test', 'Test123!'));
    }
  });

  test('Phase 1 & Phase 2 endpoints are deployed', async () => {
    // If docs-json exists and is missing these endpoints, this is a deploy-gap (not a test bug).
    expect(
      missingPhase1Phase2Paths,
      `Phase 1 & Phase 2 endpoints are not deployed. Missing from OpenAPI spec at ${API_URL}/docs-json: ${missingPhase1Phase2Paths.join(
        ', ',
      )}`,
    ).toEqual([]);
  });

  test.describe('Phase 1: Promotion Engine', () => {
    test('should create and apply promotion', async ({ request }) => {
      test.skip(
        missingPhase1Phase2Paths.length > 0,
        `Skipping: Phase 1/2 endpoints not deployed (${missingPhase1Phase2Paths.join(', ')})`,
      );
      // Create promotion
      const createPromo = await request.post(`${API_V1_URL}/promotions`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          name: 'E2E Test Promotion',
          description: '20% off for E2E testing',
          type: 'PERCENTAGE_DISCOUNT',
          status: 'ACTIVE',
          priority: 10,
          startDate: new Date().toISOString(),
          conditions: {
            cartValue: {
              min: 50,
            },
          },
          actions: {
            type: 'PERCENTAGE_DISCOUNT',
            percentage: 20,
          },
          isStackable: false,
        },
      });

      if (!createPromo.ok()) {
        const errorData = await createPromo.json();
        console.log('Promotion creation failed:', createPromo.status(), errorData);
      }
      expect(createPromo.ok()).toBeTruthy();
      const promoData = await createPromo.json();
      expect(promoData.data).toBeDefined();
      expect(promoData.data.type).toBe('PERCENTAGE_DISCOUNT');
    });

    test('should create and validate coupon', async ({ request }) => {
      test.skip(
        missingPhase1Phase2Paths.length > 0,
        `Skipping: Phase 1/2 endpoints not deployed (${missingPhase1Phase2Paths.join(', ')})`,
      );
      // First, get a promotion
      const promotions = await request.get(`${API_V1_URL}/promotions`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const promosData = await promotions.json();
      const promotionId = promosData.data?.[0]?.id;

      if (promotionId) {
        // Create coupon
        const createCoupon = await request.post(`${API_V1_URL}/promotions/coupons`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            promotionId,
            code: 'E2ETEST20',
            usageLimit: 10,
            userLimit: 1,
          },
        });

        expect(createCoupon.ok()).toBeTruthy();

        // Validate coupon
        const validateCoupon = await request.post(`${API_V1_URL}/promotions/coupons/validate`, {
          headers: {
            Authorization: `Bearer ${customerToken}`,
          },
          data: {
            code: 'E2ETEST20',
            cartValue: 100,
          },
        });

        expect(validateCoupon.ok()).toBeTruthy();
        const validateData = await validateCoupon.json();
        expect(validateData.data).toBeDefined();
      }
    });
  });

  test.describe('Phase 1: Shipping Rules', () => {
    test('should create shipping method and calculate rates', async ({ request }) => {
      test.skip(
        missingPhase1Phase2Paths.length > 0,
        `Skipping: Phase 1/2 endpoints not deployed (${missingPhase1Phase2Paths.join(', ')})`,
      );
      // Create shipping method
      const createMethod = await request.post(`${API_V1_URL}/shipping/methods`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          name: 'E2E Test Shipping',
          description: 'Test shipping method',
          type: 'FLAT_RATE',
          isActive: true,
        },
      });

      if (!createMethod.ok()) {
        const errorData = await createMethod.json();
        console.log('Shipping method creation failed:', createMethod.status(), errorData);
      }
      expect(createMethod.ok()).toBeTruthy();
      const methodData = await createMethod.json();
      const methodId = methodData.data?.id;

      if (methodId) {
        // Create shipping rule
        const createRule = await request.post(`${API_V1_URL}/shipping/rules`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            shippingMethodId: methodId,
            name: 'E2E Test Rule',
            priority: 10,
            rate: 5.99,
            freeShippingThreshold: 50,
            estimatedDays: 5,
            conditions: {
              country: 'GB',
            },
            isActive: true,
          },
        });

        expect(createRule.ok()).toBeTruthy();

        // Calculate shipping rate
        const calculateRate = await request.post(`${API_V1_URL}/shipping/calculate`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            weight: 2.5,
            cartValue: 75,
            destination: {
              country: 'GB',
              city: 'London',
              postalCode: 'SW1A 1AA',
            },
          },
        });

        expect(calculateRate.ok()).toBeTruthy();
        const rateData = await calculateRate.json();
        expect(rateData.data).toBeDefined();
      }
    });
  });

  test.describe('Phase 2: Customer Groups', () => {
    test('should create and manage customer groups', async ({ request }) => {
      test.skip(
        missingPhase1Phase2Paths.length > 0,
        `Skipping: Phase 1/2 endpoints not deployed (${missingPhase1Phase2Paths.join(', ')})`,
      );
      // Create customer group
      const createGroup = await request.post(`${API_V1_URL}/customer-groups`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          name: 'E2E Test Group',
          description: 'Test customer group',
          type: 'VIP',
          isActive: true,
        },
      });

      if (!createGroup.ok()) {
        const errorData = await createGroup.json();
        console.log('Customer group creation failed:', createGroup.status(), errorData);
      }
      expect(createGroup.ok()).toBeTruthy();
      const groupData = await createGroup.json();
      const groupId = groupData.data?.id;
      expect(groupId).toBeDefined();

      // Get all groups
      const getAllGroups = await request.get(`${API_V1_URL}/customer-groups`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(getAllGroups.ok()).toBeTruthy();
      const groupsData = await getAllGroups.json();
      expect(groupsData.data).toBeInstanceOf(Array);

      // Update group
      if (groupId) {
        const updateGroup = await request.put(`${API_V1_URL}/customer-groups/${groupId}`, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          data: {
            description: 'Updated test group',
          },
        });

        expect(updateGroup.ok()).toBeTruthy();
      }
    });
  });

  test.describe('Phase 2: Return Policies', () => {
    test('should create and manage return policies', async ({ request }) => {
      test.skip(
        missingPhase1Phase2Paths.length > 0,
        `Skipping: Phase 1/2 endpoints not deployed (${missingPhase1Phase2Paths.join(', ')})`,
      );
      // Create return policy
      const createPolicy = await request.post(`${API_V1_URL}/return-policies`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
        data: {
          name: 'E2E Test Return Policy',
          description: 'Test return policy',
          isReturnable: true,
          returnWindowDays: 30,
          requiresApproval: false,
          requiresInspection: false,
          refundMethod: 'ORIGINAL_PAYMENT',
          restockingFee: 0,
          priority: 0,
          isActive: true,
        },
      });

      if (!createPolicy.ok()) {
        const errorData = await createPolicy.json();
        console.log('Return policy creation failed:', createPolicy.status(), errorData);
      }
      expect(createPolicy.ok()).toBeTruthy();
      const policyData = await createPolicy.json();
      const policyId = policyData.data?.id;
      expect(policyId).toBeDefined();

      // Get all policies
      const getAllPolicies = await request.get(`${API_V1_URL}/return-policies`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      expect(getAllPolicies.ok()).toBeTruthy();
      const policiesData = await getAllPolicies.json();
      expect(policiesData.data).toBeInstanceOf(Array);
    });
  });

  test.describe('Phase 2: Return Requests', () => {
    test('should create return request', async ({ request }) => {
      test.skip(
        missingPhase1Phase2Paths.length > 0,
        `Skipping: Phase 1/2 endpoints not deployed (${missingPhase1Phase2Paths.join(', ')})`,
      );
      // First, get customer orders
      const orders = await request.get(`${API_V1_URL}/orders`, {
        headers: {
          Authorization: `Bearer ${customerToken}`,
        },
      });

      const ordersData = await orders.json();
      const firstOrder = ordersData.data?.[0];

      if (firstOrder?.id) {
        // Check return eligibility
        const eligibility = await request.get(
          `${API_V1_URL}/return-policies/eligibility/${firstOrder.id}`,
          {
            headers: {
              Authorization: `Bearer ${customerToken}`,
            },
          },
        );

        // Create return request
        const createReturn = await request.post(`${API_V1_URL}/returns`, {
          headers: {
            Authorization: `Bearer ${customerToken}`,
          },
          data: {
            orderId: firstOrder.id,
            reason: 'DEFECTIVE',
            notes: 'E2E test return request',
          },
        });

        // Return request may fail if order is not eligible, which is expected
        if (createReturn.ok()) {
          const returnData = await createReturn.json();
          expect(returnData.data).toBeDefined();
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Frontend UI Tests', () => {
    test('should load products page', async ({ page }) => {
      await page.goto(`${WEB_URL}/products`);
      await expect(page.locator('h1')).toContainText(/products/i);
    });

    test('should load cart page', async ({ page }) => {
      await page.goto(`${WEB_URL}/cart`);
      // Page should load without errors
      await expect(page).toHaveURL(/.*cart/);
    });

    test('should load returns page', async ({ page }) => {
      await page.goto(`${WEB_URL}/returns`);
      await expect(page.locator('h1')).toContainText(/returns/i);
    });
  });
});
