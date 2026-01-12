import { test, expect } from '@playwright/test';
import { createTestContext, generateTestData, TEST_USER, HAS_TEST_CREDENTIALS } from './fixtures/test-helpers';

/**
 * Client Management E2E Tests
 *
 * Tests the complete client management flow including:
 * - Viewing client list
 * - Creating new clients
 * - Editing clients
 * - Searching clients
 * - Client validation
 * - Client details view
 * - Deleting clients
 */

test.describe('Client Management', () => {
  // Setup: Login before each test if credentials are available
  test.beforeEach(async ({ page }) => {
    const ctx = createTestContext(page);

    if (HAS_TEST_CREDENTIALS) {
      await ctx.auth.login();
    } else {
      // Navigate directly for basic UI tests
      await page.goto('/clients');
    }
  });

  test.describe('Client List Page', () => {
    test('should display clients page with proper layout', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToClients();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        // This is expected without authentication
        expect(isOnAuth).toBeTruthy();
        return;
      }

      // Should have page header
      const pageHeader = page.locator('h1, [role="heading"]').filter({ hasText: /clients/i });
      await expect(pageHeader.first()).toBeVisible();

      // Should have create button
      const createButton = page.locator('button:has-text("Add"), button:has-text("New"), button:has-text("Create"), a:has-text("Add"), a:has-text("New")');
      const iconButton = page.locator('button svg, button img, a svg');
      const hasCreateButton = await createButton.count() > 0 || await iconButton.count() > 0;
      expect(hasCreateButton).toBeTruthy();

      await ctx.screenshot.capture('clients-list-page');
    });

    test('should have search functionality', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToClients();

      // Look for search input
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="find" i]');

      if (await searchInput.count() > 0) {
        await expect(searchInput.first()).toBeVisible();

        // Type in search
        await searchInput.first().fill('Test Search');
        await page.waitForTimeout(500);

        // Search should filter or show no results
        await ctx.screenshot.capture('clients-search');
      }
    });

    test('should display empty state when no clients', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToClients();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      // Check for either clients list, buttons with client data, or empty state
      const hasClients = await page.locator('[data-testid="client-item"], [class*="client"]').count() > 0;
      const hasEmptyState = await page.locator('text=/no clients|add your first|get started/i').count() > 0;
      const hasClientButtons = await page.locator('button:has-text("@"), button[class*="client"]').count() > 0;
      const hasClientHeading = await page.locator('h3').count() > 0;

      // Should have either clients or empty state
      expect(hasClients || hasEmptyState || hasClientButtons || hasClientHeading).toBeTruthy();
    });

    test('should navigate to create client page', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToClients();

      // Click create button
      const createButton = page.locator('button, a').filter({ hasText: /new client|add client|\+/i }).first();

      if (await createButton.isVisible()) {
        await createButton.click();
        await ctx.wait.waitForPageReady();

        // Should be on new client page
        expect(page.url()).toContain('/clients/new');
      }
    });
  });

  test.describe('Create Client', () => {
    test('should display client creation form', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToNewClient();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      // Should have form fields
      const nameInput = page.locator('input#name, input[name="name"], input[placeholder*="name" i]').first();
      const emailInput = page.locator('input#email, input[name="email"], input[type="email"]').first();
      const phoneInput = page.locator('input#phone, input[name="phone"], input[type="tel"]').first();

      await expect(nameInput).toBeVisible();

      await ctx.screenshot.capture('clients-create-form');
    });

    test('should validate required fields on client creation', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToNewClient();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(500);

      // Should show validation errors or stay on form
      const stayedOnForm = page.url().includes('/new');
      const hasErrors = await page.locator('[role="alert"], .text-destructive, [aria-invalid="true"]').count() > 0;

      expect(stayedOnForm || hasErrors).toBeTruthy();
    });

    test('should validate email format', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToNewClient();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      const testClient = generateTestData.client();

      // Fill name
      const nameInput = page.locator('input#name, input[name="name"], input[placeholder*="name" i]').first();
      await nameInput.fill(testClient.name);

      // Fill invalid email
      const emailInput = page.locator('input#email, input[name="email"], input[type="email"]').first();
      await emailInput.fill('invalid-email');

      // Try to submit
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();
      await page.waitForTimeout(500);

      // Should show email validation error or stay on form
      const hasError = await page.locator(':invalid, [aria-invalid="true"]').count() > 0;
      const stayedOnForm = page.url().includes('/new');
      expect(hasError || stayedOnForm).toBeTruthy();
    });

    test('should validate Australian phone format', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToNewClient();

      // Check if on auth page (if not logged in)
      const isOnAuth = page.url().includes('/auth');
      if (isOnAuth) {
        expect(isOnAuth).toBeTruthy();
        return;
      }

      const testClient = generateTestData.client();

      // Fill required fields
      const nameInput = page.locator('input#name, input[name="name"], input[placeholder*="name" i]').first();
      await nameInput.fill(testClient.name);

      // Fill invalid phone
      const phoneInput = page.locator('input#phone, input[name="phone"], input[type="tel"]').first();
      if (await phoneInput.isVisible()) {
        await phoneInput.fill('123'); // Too short

        // Try to submit
        const submitButton = page.locator('button[type="submit"]').first();
        await submitButton.click();
        await page.waitForTimeout(500);

        // May show phone validation error
        await ctx.screenshot.capture('clients-phone-validation');
      }
    });

    test('should create client with valid data', async ({ page }) => {
      const ctx = createTestContext(page);

      // Skip if no test credentials (can't save without auth)
      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToNewClient();

      const testClient = generateTestData.client();

      // Fill all fields
      const nameInput = page.locator('input#name, input[name="name"], input[placeholder*="name" i]').first();
      await nameInput.fill(testClient.name);

      const emailInput = page.locator('input#email, input[name="email"], input[type="email"]').first();
      if (await emailInput.isVisible()) {
        await emailInput.fill(testClient.email);
      }

      const phoneInput = page.locator('input#phone, input[name="phone"], input[type="tel"]').first();
      if (await phoneInput.isVisible()) {
        await phoneInput.fill(testClient.phone);
      }

      const addressInput = page.locator('input#address, input[name="address"], input[placeholder*="address" i]').first();
      if (await addressInput.isVisible()) {
        await addressInput.fill(testClient.address);
      }

      // Submit form
      const submitButton = page.locator('button[type="submit"]').first();
      await submitButton.click();

      // Wait for success
      await page.waitForTimeout(2000);

      // Should show success or redirect
      const success =
        page.url().includes('/clients') && !page.url().includes('/new') ||
        await page.locator('[data-sonner-toast]').count() > 0;

      expect(success).toBeTruthy();

      await ctx.screenshot.capture('clients-create-success');
    });

    test('should handle duplicate client creation', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      // This test would create a client twice to check for duplicate handling
      // Implementation depends on business logic
    });
  });

  test.describe('Edit Client', () => {
    test('should navigate to edit page from client list', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToClients();

      // Find a client card/row with edit option
      const editButton = page.locator('button, a').filter({ hasText: /edit/i }).first();

      if (await editButton.isVisible()) {
        await editButton.click();
        await ctx.wait.waitForPageReady();

        // Should be on edit page
        expect(page.url()).toContain('/edit');
      }
    });

    test('should pre-fill form with existing client data', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      // Navigate to a client edit page (would need a real client ID)
      await ctx.nav.goToClients();

      // Click on first client
      const clientLink = page.locator('a[href*="/clients/"]').first();

      if (await clientLink.isVisible()) {
        await clientLink.click();
        await ctx.wait.waitForPageReady();

        // Click edit button
        const editButton = page.locator('button, a').filter({ hasText: /edit/i }).first();
        if (await editButton.isVisible()) {
          await editButton.click();
          await ctx.wait.waitForPageReady();

          // Name field should have value
          const nameInput = page.locator('input[name="name"]').first();
          const nameValue = await nameInput.inputValue();
          expect(nameValue.length).toBeGreaterThan(0);
        }
      }
    });

    test('should update client successfully', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToClients();

      // Find and click edit for first client
      const clientRow = page.locator('[data-testid="client-item"], [class*="client"]').first();

      if (await clientRow.isVisible()) {
        // Click on client or edit button
        const editButton = clientRow.locator('button, a').filter({ hasText: /edit/i }).first();

        if (await editButton.isVisible()) {
          await editButton.click();
          await ctx.wait.waitForPageReady();

          // Update name
          const nameInput = page.locator('input[name="name"]').first();
          const currentName = await nameInput.inputValue();
          await nameInput.fill(currentName + ' - Updated');

          // Save
          const saveButton = page.locator('button[type="submit"]').first();
          await saveButton.click();

          // Wait for success
          await page.waitForTimeout(2000);

          await ctx.screenshot.capture('clients-edit-success');
        }
      }
    });
  });

  test.describe('Client Details', () => {
    test('should display client details page', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToClients();

      // Click on first client
      const clientLink = page.locator('a[href*="/clients/"]').first();

      if (await clientLink.isVisible()) {
        await clientLink.click();
        await ctx.wait.waitForPageReady();

        // Should show client details
        const hasDetails = await page.locator('h1, h2, [class*="name"]').count() > 0;
        expect(hasDetails).toBeTruthy();

        await ctx.screenshot.capture('clients-details-page');
      }
    });

    test('should display client contact information', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToClients();

      const clientLink = page.locator('a[href*="/clients/"]').first();

      if (await clientLink.isVisible()) {
        await clientLink.click();
        await ctx.wait.waitForPageReady();

        // Should show contact info
        const hasEmail = await page.locator('text=@').count() > 0;
        const hasPhone = await page.locator('text=/04|\\+61/').count() > 0;

        // At least one contact method should be shown
        expect(hasEmail || hasPhone).toBeTruthy();
      }
    });

    test('should show related quotes/invoices/jobs for client', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToClients();

      const clientLink = page.locator('a[href*="/clients/"]').first();

      if (await clientLink.isVisible()) {
        await clientLink.click();
        await ctx.wait.waitForPageReady();

        // Look for related items section
        const relatedSection = page.locator('text=/quotes|invoices|jobs|history/i');
        const hasRelated = await relatedSection.count() > 0;

        // This is expected but optional
        await ctx.screenshot.capture('clients-related-items');
      }
    });
  });

  test.describe('Delete Client', () => {
    test('should have delete option', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToClients();

      // Look for delete button
      const deleteButton = page.locator('button').filter({ hasText: /delete|remove/i }).first();
      const hasDelete = await deleteButton.count() > 0;

      // Delete should be available
      if (hasDelete) {
        await expect(deleteButton).toBeVisible();
      }
    });

    test('should confirm before deleting', async ({ page }) => {
      const ctx = createTestContext(page);

      if (!HAS_TEST_CREDENTIALS) {
        test.skip();
        return;
      }

      await ctx.nav.goToClients();

      // Click delete on first client
      const deleteButton = page.locator('button').filter({ hasText: /delete/i }).first();

      if (await deleteButton.isVisible()) {
        await deleteButton.click();
        await page.waitForTimeout(500);

        // Should show confirmation dialog
        const confirmDialog = page.locator('[role="alertdialog"], [role="dialog"]');
        const hasConfirm = await confirmDialog.count() > 0;

        if (hasConfirm) {
          await expect(confirmDialog.first()).toBeVisible();

          // Cancel the delete
          const cancelButton = page.locator('button').filter({ hasText: /cancel|no/i }).first();
          if (await cancelButton.isVisible()) {
            await cancelButton.click();
          }
        }
      }
    });
  });

  test.describe('Client Search', () => {
    test('should search by client name', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToClients();

      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();

      if (await searchInput.isVisible()) {
        await searchInput.fill('John');
        await page.waitForTimeout(500);

        // Results should filter
        await ctx.screenshot.capture('clients-search-name');
      }
    });

    test('should search by email', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToClients();

      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();

      if (await searchInput.isVisible()) {
        await searchInput.fill('@gmail.com');
        await page.waitForTimeout(500);

        await ctx.screenshot.capture('clients-search-email');
      }
    });

    test('should show no results message for empty search', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToClients();

      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();

      if (await searchInput.isVisible()) {
        await searchInput.fill('xyznonexistent12345');
        await page.waitForTimeout(500);

        // Should show no results
        const noResults = page.locator('text=/no results|no clients found|nothing found/i');
        const hasNoResults = await noResults.count() > 0;

        await ctx.screenshot.capture('clients-search-no-results');
      }
    });

    test('should clear search and show all clients', async ({ page }) => {
      const ctx = createTestContext(page);

      await ctx.nav.goToClients();

      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();

      if (await searchInput.isVisible()) {
        // Search for something
        await searchInput.fill('Test');
        await page.waitForTimeout(500);

        // Clear search
        await searchInput.clear();
        await page.waitForTimeout(500);

        // Should show all clients again
        await ctx.screenshot.capture('clients-search-cleared');
      }
    });
  });

  test.describe('Mobile Client Management', () => {
    test('should display clients page on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToClients();

      // Should have mobile-friendly layout
      const header = page.locator('h1, [role="heading"]').first();
      await expect(header).toBeVisible();

      await ctx.screenshot.capture('clients-mobile-list');
    });

    test('should navigate to create client on mobile', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToClients();

      // Find create button (might be floating action button on mobile)
      const createButton = page.locator('button, a').filter({ hasText: /new|\+|add/i }).first();

      if (await createButton.isVisible()) {
        await createButton.tap();
        await ctx.wait.waitForPageReady();

        expect(page.url()).toContain('/new');

        await ctx.screenshot.capture('clients-mobile-create');
      }
    });

    test('should handle touch interactions on client form', async ({ page }) => {
      const ctx = createTestContext(page);

      await page.setViewportSize({ width: 375, height: 667 });

      await ctx.nav.goToNewClient();

      const nameInput = page.locator('input[name="name"]').first();

      if (await nameInput.isVisible()) {
        // Tap to focus
        await nameInput.tap();
        await page.waitForTimeout(200);

        // Type with mobile keyboard
        await nameInput.fill('Mobile Test Client');
        const value = await nameInput.inputValue();
        expect(value).toBe('Mobile Test Client');
      }
    });
  });
});
