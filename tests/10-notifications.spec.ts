import { test, expect } from '@playwright/test';
import { CREDS, hasCreds } from './helpers/env';
import { settle, loginIfNeeded, assertNoCrash } from './helpers/actions';

// ════════════════════════════════════════════════════════════════════════════
//  Notifications locales : vérifie que « Activer les notifications » demande la
//  permission, l'enregistre et déclenche une notification OS (via new Notification
//  ou registration.showNotification — les deux sont espionnés).
//  Ignoré si GUICHETIERE_* absents.
// ════════════════════════════════════════════════════════════════════════════

test('Notifications locales — activation + notif de test', async ({ page, context }) => {
  test.skip(!hasCreds(CREDS.guichetiere), 'GUICHETIERE_* non fournis');

  await context.grantPermissions(['notifications']);
  await page.addInitScript(() => {
    // @ts-ignore
    window.__notifs = [];
    const O = window.Notification;
    if (O) {
      // @ts-ignore
      function N(title, opts) { window.__notifs.push(title); return new O(title, opts); }
      // @ts-ignore
      N.permission = 'granted';
      // @ts-ignore
      N.requestPermission = () => Promise.resolve('granted');
      // @ts-ignore
      window.Notification = N;
    }
    // @ts-ignore
    if (self.ServiceWorkerRegistration && ServiceWorkerRegistration.prototype.showNotification) {
      const orig = ServiceWorkerRegistration.prototype.showNotification;
      // @ts-ignore
      ServiceWorkerRegistration.prototype.showNotification = function (title, opts) { window.__notifs.push(title); return orig.call(this, title, opts); };
    }
  });

  await page.goto('/espace-guichetiere');
  await settle(page, 600);
  await loginIfNeeded(page, CREDS.guichetiere);
  await settle(page, 800);
  await assertNoCrash(page);

  const btn = page.getByRole('button', { name: /Activer les notifications/i }).first();
  await expect(btn, 'Le bouton « Activer les notifications » doit être visible').toBeVisible({ timeout: 10000 });
  await btn.click();
  await settle(page, 1500);

  const enabled = await page.evaluate(() => localStorage.getItem('local_notif_enabled'));
  const notifs = await page.evaluate(() => (window as unknown as { __notifs: string[] }).__notifs || []);
  // eslint-disable-next-line no-console
  console.log(`[NOTIF] local_notif_enabled=${enabled} · notifs émises=${JSON.stringify(notifs)}`);

  expect(enabled, 'les notifications locales doivent être activées').toBe('1');
  expect(notifs.some((t) => /Notifications activées/i.test(t)), 'une notification de test doit être émise').toBeTruthy();
});
