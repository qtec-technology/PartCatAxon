import { expect, test, type Locator, type Page } from '@playwright/test';

const MANUAL_WORKSPACE_URL =
  '/bulk-cost?tab=new&supplier=VF0072&supplierName=GRAINGER%20INTERNATIONAL';

async function fillCostField(page: Page, id: string, value: string) {
  const input = page.locator(`#${id}`);
  await expect(input).toBeVisible({ timeout: 20_000 });
  await input.fill(value);
}

async function chooseFirstNonEmptyOption(locator: Locator) {
  await locator.evaluate((select) => {
    const element = select as HTMLSelectElement;
    const nextValue = Array.from(element.options).find((option) => option.value.trim() !== '')?.value;
    if (!nextValue) return;
    element.value = nextValue;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function openFirstLineEditor(page: Page) {
  const editButton = page.getByRole('button', { name: 'Edit line details' }).first();
  await expect(editButton).toBeVisible({ timeout: 20_000 });
  await editButton.click();
  await expect(page.locator('.line-edit-modal-content')).toBeVisible({ timeout: 10_000 });
}

async function closeLineEditor(page: Page) {
  await page.locator('.line-edit-modal-close').click();
  await expect(page.locator('.line-edit-modal-content')).toBeHidden({ timeout: 10_000 });
}

async function fillFirstLineBaseData(page: Page, withWeight: boolean) {
  await openFirstLineEditor(page);

  await page.locator('.line-edit-modal-field:has(label:has-text("Mfr Brand")) input').first().fill('PROTO');
  await page.locator('.line-edit-modal-field:has(label:has-text("Mfr Catalog No")) input').first().fill('QA-PROTO-100');
  await page.locator('.line-edit-modal-field:has(label:has-text("Country of Origin")) input').first().fill('US');
  await chooseFirstNonEmptyOption(page.locator('.line-edit-modal-field:has(label:has-text("Stock UOM")) select').first());
  await page
    .locator('.line-edit-modal-field:has(label:has-text("Item Description")) textarea')
    .first()
    .fill('QA manual workspace validation item');

  await page.locator('.line-edit-modal-tabs button', { hasText: 'Order Price' }).first().click();
  await page.locator('.line-edit-modal-field:has(label:has-text("Unit Price")) input').first().fill('100');
  await page.locator('.line-edit-modal-field:has(label:has-text("Qty")) input').first().fill('2');

  if (withWeight) {
    await page.locator('.line-edit-modal-tabs button', { hasText: 'Purchase Term' }).first().click();
    await page.locator('.line-edit-modal-field:has(label:has-text("Chargeable Wt/Ea")) input').first().fill('5');
  }

  await closeLineEditor(page);
}

test.describe('Cost Workspace smoke QA', () => {
  test('new manual workspace is ready for user entry without page-level horizontal scroll', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(MANUAL_WORKSPACE_URL);

    await expect(page.getByRole('heading', { name: 'Manual Cost Workspace' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('.add-item-btn')).toBeVisible();

    const hasPageHorizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    expect(hasPageHorizontalScroll).toBe(false);
  });

  test('does not expose database implementation names to users', async ({ page }) => {
    await page.goto(MANUAL_WORKSPACE_URL);

    await expect(page.getByRole('heading', { name: 'Manual Cost Workspace' })).toBeVisible({
      timeout: 20_000,
    });
    const bodyText = await page.locator('body').innerText();

    expect(bodyText).not.toContain('PART_CATALOG_AIX');
    expect(bodyText).not.toContain('SBOQTEC');
    expect(bodyText).not.toContain('@POITM');
    expect(bodyText).not.toContain('@PITM1');
  });

  test('manual calculation blocks missing weight, then succeeds after weight is entered', async ({ page }) => {
    await page.goto(MANUAL_WORKSPACE_URL);

    await expect(page.getByRole('heading', { name: 'Manual Cost Workspace' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 20_000 });

    await fillCostField(page, 'bulk-cost-exchange-rate', '35');
    await fillCostField(page, 'bulk-cost-pkh', '75');
    await fillCostField(page, 'bulk-cost-freight', '1000');
    await fillCostField(page, 'bulk-cost-customs', '100');

    await fillFirstLineBaseData(page, false);

    await page.getByRole('button', { name: 'CAL', exact: true }).click();
    const missingWeightPanelError = page
      .locator('.run-warning-item.error')
      .filter({ hasText: 'Cannot calculate: Some selected items are missing weight' });
    await expect(missingWeightPanelError).toBeVisible({ timeout: 10_000 });

    await fillFirstLineBaseData(page, true);
    await page.getByRole('button', { name: 'CAL', exact: true }).click();

    await expect(page.locator('#preview-title')).toBeVisible({ timeout: 20_000 });
    await expect(missingWeightPanelError).toBeHidden({ timeout: 10_000 });

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('undefined');
  });
});
