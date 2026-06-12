import { test, expect } from '@playwright/test';

test('l’application se charge correctement', async ({ page }) => {
  await page.goto('https://gestionpdv.vercel.app');

  await expect(page).toHaveTitle(/Gestion|PDV|PMU/i);
});