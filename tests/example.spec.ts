import { test, expect } from '@playwright/test';

// Test minimal : l'application répond sur la BASE_URL configurée.
// (Scénarios complets : 01-public-smoke / 02-exploitation / 03-spaces.)
test('chargement de base', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/.+/);
});
