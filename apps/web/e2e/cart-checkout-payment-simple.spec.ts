import { test, expect } from '@playwright/test';

/**
 * Simplified Cart → Checkout → Payment Flow Tests
 * 
 * These tests are more resilient and focus on core functionality.
 */

test.describe('Cart Page', () => {
  test('should load cart page', async ({ page }) => {
    await page.goto('/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    
    // Check for main heading
    const heading = page.getByRole('heading', { name: /Shopping Cart/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('should show empty cart message when cart is empty', async ({ page }) => {
    await page.goto('/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    
    // Check for empty cart message
    const emptyMessage = page.getByText('Your cart is empty');
    await expect(emptyMessage).toBeVisible({ timeout: 10000 });
  });

  test('should have header and footer', async ({ page }) => {
    await page.goto('/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    
    // Check for header and footer
    await expect(page.locator('header')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('footer')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Checkout Page', () => {
  test('should load checkout page', async ({ page }) => {
    await page.goto('/checkout', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    
    // Check for main heading
    const heading = page.getByRole('heading', { name: /Checkout/i });
    await expect(heading).toBeVisible({ timeout: 10000 });
  });

  test('should have header and footer', async ({ page }) => {
    await page.goto('/checkout', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    
    await expect(page.locator('header')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('footer')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Payment Page', () => {
  test('should show error when accessed without orderId', async ({ page }) => {
    await page.goto('/payment', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Wait for loading to complete - either error heading appears or loading text disappears
    // Best practice: wait for the expected state rather than arbitrary timeout
    await Promise.race([
      page.waitForSelector('h1:has-text("Order Not Found")', { timeout: 10000 }).catch(() => null),
      page.waitForSelector('text=/Loading order details/i', { state: 'hidden', timeout: 10000 }).catch(() => null),
    ]);
    
    // Now check for the error heading (most reliable indicator)
    const errorHeading = page.getByRole('heading', { name: /Order Not Found/i });
    await expect(errorHeading).toBeVisible({ timeout: 5000 });
  });

  test('should show error with invalid orderId', async ({ page }) => {
    await page.goto('/payment?orderId=invalid-id', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    
    // Wait a bit for error to appear
    await page.waitForTimeout(2000);
    
    const hasError = await page.getByText(/Order Not Found/i).isVisible().catch(() => false);
    expect(hasError).toBeTruthy();
  });
});

test.describe('Navigation', () => {
  test('should navigate from cart to products', async ({ page }) => {
    await page.goto('/cart', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
    
    // Click browse products link
    const browseLink = page.getByRole('link', { name: 'Browse Products' });
    if (await browseLink.isVisible().catch(() => false)) {
      await browseLink.click({ timeout: 10000 });
      await expect(page).toHaveURL(/.*\/products/, { timeout: 10000 });
    }
  });
});
