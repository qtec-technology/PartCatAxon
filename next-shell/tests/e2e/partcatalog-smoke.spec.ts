import { expect, test } from '@playwright/test';

test.describe('PartCatalog smoke QA', () => {
  test('user picture fallback renders without exposing a broken image', async ({ page }) => {
    await page.route('**/api/auth/user-picture', (route) => {
      void route.fulfill({ status: 404, body: '' });
    });

    await page.goto('/partcatalog');

    await expect(page.getByText('USER')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('PICTURE')).toBeVisible();
    await expect(page.locator('img[alt="User"]')).toHaveCount(0);
  });

  test('does not expose database implementation names to users', async ({ page }) => {
    await page.goto('/partcatalog');

    await expect(page.getByText('QTEC PART CATALOG SYSTEM')).toBeVisible({ timeout: 15_000 });
    const bodyText = await page.locator('body').innerText();

    expect(bodyText).not.toContain('PART_CATALOG_AIX');
    expect(bodyText).not.toContain('SBOQTEC');
    expect(bodyText).not.toContain('@POITM');
    expect(bodyText).not.toContain('@PITM1');
  });
});
