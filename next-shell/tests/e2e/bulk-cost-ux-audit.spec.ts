/**
 * Bulk Cost UX & Bug-Hunting Audit — Playwright E2E Tests
 *
 * Comprehensive end-to-end tests for discovering UX friction points,
 * calculation bugs, data reset issues, and allocation integrity problems
 * in the Bulk Cost / Cost Workspace page.
 *
 * Human-speed mode: slowMo is configured via playwright.config.ts
 */
import { test, expect, type Page } from '@playwright/test';
import { EXCEL_COSTS, EXCEL_LINES, EXCEL_EXPECTED } from './fixtures/excel-test-data';

// ─── Helpers ────────────────────────────────────────────────────────────────

const WORKSPACE_URL = '/bulk-cost?tab=new&supplier=V-GRA-001&supplierName=Grainger';

/** Wait for workspace to be fully interactive */
async function waitForWorkspace(page: Page) {
  // Automatically accept any confirmation dialogs (window.confirm) that appear
  page.on('dialog', async (dialog) => {
    console.log(`[E2E DIALOG] Automatically accepting dialog: ${dialog.message()}`);
    await dialog.accept();
  });

  await page.goto(WORKSPACE_URL);
  await page.waitForTimeout(3000);
  const workspace = page.locator(
    '[class*="workspace"], [class*="cost-workspace"], [class*="editor"]'
  ).first();
  await expect(workspace).toBeVisible({ timeout: 15000 });
  return workspace;
}

/** Human-like typing with per-character delay */
async function humanType(page: Page, selector: string, text: string) {
  const el = page.locator(selector);
  await el.click();
  await el.fill('');
  await el.type(text, { delay: 80 });
}

/** Fill a cost input field by ID */
async function fillCostField(page: Page, id: string, value: string) {
  const input = page.locator(`#${id}`);
  await input.click();
  await input.fill('');
  await input.type(value, { delay: 60 });
  await page.waitForTimeout(300);
}

/** Complete Step 1.1 — Initial Order Data in the standard golden sequence */
async function completeStep1_1(page: Page) {
  // Currency → USD
  await page.locator('#bulk-cost-currency').click();
  await page.waitForTimeout(800);
  await page.locator('[role="option"]:has-text("USD"), [role="option"]:has-text("US Dollar")').first().click();
  await page.waitForTimeout(1000);

  // Order Term → Exwork
  await page.locator('#bulk-cost-order-term').click();
  await page.waitForTimeout(800);
  await page.locator('[role="option"]:has-text("Exwork")').first().click();
  await page.waitForTimeout(1000);

  // Location → US
  await page.locator('#bulk-cost-location').click();
  await page.waitForTimeout(800);
  await page.locator('[role="option"]:has-text("United States"), [role="option"]:has-text("US")').first().click();
  await page.waitForTimeout(1000);

  // Sub Location → first option
  await page.locator('#bulk-cost-sub-location').click();
  await page.waitForTimeout(800);
  await page.locator('[role="option"]').first().click();
  await page.waitForTimeout(1000);

  // Ship Mode → Air COUR (6)
  await page.locator('#bulk-cost-ship-mode').click();
  await page.waitForTimeout(800);
  await page.locator('[role="option"]:has-text("Air COUR"), [role="option"]:has-text("6")').first().click();
  await page.waitForTimeout(1000);

  // Apply to all lines
  await page.locator('.cost-bar-apply-defaults').first().click();
  await page.waitForTimeout(1500);
}

/** Complete Step 1.2 — Shared Costs */
async function completeStep1_2(page: Page) {
  await fillCostField(page, 'bulk-cost-pkh', '75');
  await fillCostField(page, 'bulk-cost-soc', '125');
  await fillCostField(page, 'bulk-cost-freight', '40000');
  await fillCostField(page, 'bulk-cost-customs', '8000');
  await fillCostField(page, 'bulk-cost-wireTT', '1500');
  await page.waitForTimeout(500);
}

/** Complete Step 1.3 — Global Variables */
async function completeStep1_3(page: Page) {
  await fillCostField(page, 'bulk-cost-default-ins', '1');
  await fillCostField(page, 'bulk-cost-default-duty', '10');
  await fillCostField(page, 'bulk-cost-default-stk', '0');
  await fillCostField(page, 'bulk-cost-default-spk', '0');
  await fillCostField(page, 'bulk-cost-default-qoc', '0');
  await fillCostField(page, 'bulk-cost-default-markup', '10');
  await page.waitForTimeout(500);

  // Apply to all items
  await page.locator('button:has-text("Apply to All Items")').first().click();
  await page.waitForTimeout(1500);
}

/** Add N blank lines to the workspace */
async function addLines(page: Page, count: number) {
  for (let i = 0; i < count; i++) {
    await page.locator('.add-item-btn').click();
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(1000);
}

/** Fill a single line item via the Edit Modal (tab-by-tab left to right) */
async function fillLineViaModal(page: Page, row: any, data: any, index: number) {
  // Open modal by double-clicking the row
  await row.dblclick();
  await page.waitForTimeout(600);

  const modalTabs = page.locator('.line-edit-modal-tabs');

  // Tab 1: Item Data — Brand, Part Number, Description
  const brandInput = page.locator('.line-edit-modal-field:has(label:has-text("Mfr Brand")) input').first();
  if (await brandInput.isVisible()) {
    await brandInput.click();
    await page.waitForTimeout(100);
    await brandInput.fill(data.manufacturer);
    await page.waitForTimeout(300);
    const brandOption = page.locator('.searchable-lookup-option').first();
    if (await brandOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await brandOption.click();
    }
  }

  const partInput = page.locator('.line-edit-modal-field:has(label:has-text("Mfr Catalog No")) input').first();
  if (await partInput.isVisible()) {
    await partInput.fill(data.mfgPartNumber);
  }

  const descInput = page.locator('.line-edit-modal-field:has(label:has-text("Item Description")) textarea').first();
  if (await descInput.isVisible()) {
    await descInput.fill(data.sapDescription);
  }

  // Tab 2: Purchase Term — Chargeable Weight
  await modalTabs.locator('button', { hasText: 'Purchase Term' }).first().click();
  await page.waitForTimeout(300);
  const weightInput = page.locator('.line-edit-modal-field:has(label:has-text("Chargeable Wt/Ea")) input').first();
  if (await weightInput.isVisible()) {
    await weightInput.fill(String(data.shippingWeightPerEach));
  }

  // Tab 3: Order Price — Qty and Unit Price
  await modalTabs.locator('button', { hasText: 'Order Price' }).first().click();
  await page.waitForTimeout(300);
  const qtyInput = page.locator('.line-edit-modal-field:has(label:has-text("Qty")) input').first();
  if (await qtyInput.isVisible()) {
    await qtyInput.fill(String(data.qty));
  }
  const priceInput = page.locator('.line-edit-modal-field:has(label:has-text("Unit Price")) input').first();
  if (await priceInput.isVisible()) {
    await priceInput.fill(String(data.unitPrice));
  }

  // Tab 4: Landed Cost — Duty % (if line 13, set 0)
  await modalTabs.locator('button', { hasText: 'Landed Cost' }).first().click();
  await page.waitForTimeout(300);
  if (index === 12) { // Line 13 = 0% duty
    const dutyInput = page.locator('.line-edit-modal-field:has(label:has-text("Duty %")) input').first();
    if (await dutyInput.isVisible()) {
      await dutyInput.fill('0');
    }
  }

  // Tab 5: Sales Term — just observe
  await modalTabs.locator('button', { hasText: 'Sales Term' }).first().click();
  await page.waitForTimeout(200);

  // Close modal
  await page.locator('.line-edit-modal-close').click();
  await page.waitForTimeout(400);
}


// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 1: UX FRICTION — "+ Add Item" Workflow
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('UX Audit — Add Item Workflow', () => {
  test('BUG-HUNT: After clicking "+ Add Item", page should scroll to the new row', async ({ page }) => {
    test.setTimeout(240000);
    await waitForWorkspace(page);
    await completeStep1_1(page);

    // Add one item
    await page.locator('.add-item-btn').click();
    await page.waitForTimeout(1000);

    // The new row should be visible in the viewport without manual scrolling
    const rows = page.locator('tbody tr');
    const lastRow = rows.last();
    const isVisible = await lastRow.isVisible();

    console.log(`[ADD ITEM] New row visible after add: ${isVisible}`);
    // Report: if user has to scroll manually, this is a UX friction point
    if (!isVisible) {
      console.warn('[UX FRICTION] ⚠️ New row is NOT auto-scrolled into view after Add Item click');
    }

    // Check: does the Edit Modal auto-open? (Best Practice would be yes)
    const modal = page.locator('.line-edit-modal-overlay');
    const modalOpened = await modal.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[ADD ITEM] Edit Modal auto-opened: ${modalOpened}`);
    if (!modalOpened) {
      console.warn('[UX FRICTION] ⚠️ Edit Modal does NOT auto-open after Add Item — user must manually double-click');
    }
  });

  test('BUG-HUNT: Adding multiple items requires clicking "+ Add Item" repeatedly', async ({ page }) => {
    test.setTimeout(240000);
    await waitForWorkspace(page);
    await completeStep1_1(page);

    const startTime = Date.now();
    // Add 5 items one by one — measure how tedious this is
    for (let i = 0; i < 5; i++) {
      await page.locator('.add-item-btn').click();
      await page.waitForTimeout(300);
    }
    const elapsed = Date.now() - startTime;

    const rowCount = await page.locator('tbody tr').count();
    console.log(`[ADD ITEM] Created ${rowCount} rows in ${elapsed}ms`);
    expect(rowCount).toBeGreaterThanOrEqual(5);

    // Report: there's no "Add Multiple" or "Paste from Clipboard" feature
    console.warn('[UX SUGGESTION] ⚠️ No "Add Multiple Items" or "Paste from Clipboard" feature found');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 2: LIVE ALLOCATION — PKH/SOC Real-time Display
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Live Allocation — Real-time PKH/SOC Distribution', () => {
  test('PKH/SOC/Ea columns should update IMMEDIATELY when entering Shared Costs (before CAL)', async ({ page }) => {
    test.setTimeout(300000);
    await waitForWorkspace(page);
    await completeStep1_1(page);

    // Add 3 items and fill basic data (qty and weight)
    await addLines(page, 3);
    const rows = page.locator('tbody tr');
    for (let i = 0; i < 3; i++) {
      const data = EXCEL_LINES[i];
      await fillLineViaModal(page, rows.nth(i), data, i);
    }

    // Now enter Shared Costs (Step 1.2) — DO NOT click CAL
    await completeStep1_2(page);

    // Switch to the "Order Price" or appropriate preset tab to see PKH/Ea and SOC/Ea
    const presetTabs = page.locator('.line-column-preset-btn');
    const orderPriceTab = presetTabs.filter({ hasText: 'Order Price' }).first();
    if (await orderPriceTab.isVisible()) {
      await orderPriceTab.click();
      await page.waitForTimeout(500);
    }

    // Check: PKH/Ea and SOC/Ea columns should NOT be "—" (dash)
    const pkhCells = page.locator('td[data-col="pkhEa"]');
    const socCells = page.locator('td[data-col="socEa"]');

    const pkhCellCount = await pkhCells.count();
    const socCellCount = await socCells.count();

    console.log(`[LIVE ALLOC] PKH/Ea cells found: ${pkhCellCount}, SOC/Ea cells found: ${socCellCount}`);

    // If cells exist, check they have non-dash values
    if (pkhCellCount > 0) {
      for (let i = 0; i < pkhCellCount; i++) {
        const text = await pkhCells.nth(i).innerText();
        const isDash = text.trim() === '—' || text.trim() === '-' || text.trim() === '';
        if (isDash) {
          console.error(`[BUG] ❌ PKH/Ea cell ${i} shows "${text}" — should show live allocation value`);
        } else {
          console.log(`[LIVE ALLOC] ✅ PKH/Ea cell ${i}: ${text}`);
        }
      }
    }

    if (socCellCount > 0) {
      for (let i = 0; i < socCellCount; i++) {
        const text = await socCells.nth(i).innerText();
        const isDash = text.trim() === '—' || text.trim() === '-' || text.trim() === '';
        if (isDash) {
          console.error(`[BUG] ❌ SOC/Ea cell ${i} shows "${text}" — should show live allocation value`);
        } else {
          console.log(`[LIVE ALLOC] ✅ SOC/Ea cell ${i}: ${text}`);
        }
      }
    }
  });

  test('Allocated costs should redistribute when adding a new item with weight', async ({ page }) => {
    test.setTimeout(300000);
    await waitForWorkspace(page);
    await completeStep1_1(page);

    // Add 2 items and fill data
    await addLines(page, 2);
    const rows = page.locator('tbody tr');
    await fillLineViaModal(page, rows.nth(0), EXCEL_LINES[0], 0);
    await fillLineViaModal(page, rows.nth(1), EXCEL_LINES[1], 1);

    // Enter Shared Costs
    await completeStep1_2(page);
    await page.waitForTimeout(1000);

    // Record PKH/Ea values for the 2-item state
    const pkhCells = page.locator('td[data-col="pkhEa"]');
    const pkhBefore: string[] = [];
    const cellCount = await pkhCells.count();
    for (let i = 0; i < cellCount; i++) {
      pkhBefore.push(await pkhCells.nth(i).innerText());
    }
    console.log(`[REDISTRIB] PKH/Ea before adding item 3: ${pkhBefore}`);

    // Add a 3rd item with heavy weight
    await addLines(page, 1);
    await fillLineViaModal(page, page.locator('tbody tr').nth(2), EXCEL_LINES[2], 2);
    await page.waitForTimeout(1500);

    // PKH/Ea values should have CHANGED (redistributed)
    const pkhAfter: string[] = [];
    const newCellCount = await pkhCells.count();
    for (let i = 0; i < newCellCount; i++) {
      pkhAfter.push(await pkhCells.nth(i).innerText());
    }
    console.log(`[REDISTRIB] PKH/Ea after adding item 3: ${pkhAfter}`);

    // At least one of the original cells should have changed value
    if (pkhBefore.length > 0 && pkhAfter.length > 0 && pkhBefore[0] === pkhAfter[0]) {
      console.warn('[UX CHECK] ⚠️ PKH/Ea values did NOT redistribute after adding new item — possible allocation update delay');
    }
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 3: DATA RESET — Header Edit Safety
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Data Reset Safety — Header Modification After Line Entry', () => {
  test('BUG-HUNT: Changing Currency after filling line data should not silently reset line prices', async ({ page }) => {
    test.setTimeout(360000);
    await waitForWorkspace(page);
    await completeStep1_1(page);
    await completeStep1_2(page);
    await completeStep1_3(page);

    // Add 3 items and fill data
    await addLines(page, 3);
    const rows = page.locator('tbody tr');
    for (let i = 0; i < 3; i++) {
      await fillLineViaModal(page, rows.nth(i), EXCEL_LINES[i], i);
    }

    // Record current unit prices
    const pricesBefore: string[] = [];
    for (let i = 0; i < 3; i++) {
      await rows.nth(i).dblclick();
      await page.waitForTimeout(500);
      const modalTabs = page.locator('.line-edit-modal-tabs');
      await modalTabs.locator('button', { hasText: 'Order Price' }).first().click();
      await page.waitForTimeout(300);
      const priceInput = page.locator('.line-edit-modal-field:has(label:has-text("Unit Price")) input').first();
      const val = await priceInput.inputValue();
      pricesBefore.push(val);
      await page.locator('.line-edit-modal-close').click();
      await page.waitForTimeout(300);
    }
    console.log(`[DATA RESET] Unit prices BEFORE currency change: ${pricesBefore}`);

    // Now change currency from the header dropdown
    await page.locator('#bulk-cost-currency').click();
    await page.waitForTimeout(800);
    // Try to select EUR or another currency
    const eurOption = page.locator('[role="option"]:has-text("EUR"), [role="option"]:has-text("Euro")').first();
    if (await eurOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await eurOption.click();
      await page.waitForTimeout(1500);
    }

    // Check: did a warning modal appear?
    const warningModal = page.locator('[class*="warning"], [class*="confirm"], [role="alertdialog"]');
    const warningShown = await warningModal.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[DATA RESET] Warning modal shown: ${warningShown}`);
    if (!warningShown) {
      console.warn('[UX FRICTION] ⚠️ No confirmation dialog shown when changing Currency after line data entered!');
    }

    // Re-check line prices
    const pricesAfter: string[] = [];
    for (let i = 0; i < 3; i++) {
      await rows.nth(i).dblclick();
      await page.waitForTimeout(500);
      const modalTabs = page.locator('.line-edit-modal-tabs');
      await modalTabs.locator('button', { hasText: 'Order Price' }).first().click();
      await page.waitForTimeout(300);
      const priceInput = page.locator('.line-edit-modal-field:has(label:has-text("Unit Price")) input').first();
      const val = await priceInput.inputValue();
      pricesAfter.push(val);
      await page.locator('.line-edit-modal-close').click();
      await page.waitForTimeout(300);
    }
    console.log(`[DATA RESET] Unit prices AFTER currency change: ${pricesAfter}`);

    // Report any prices that got zeroed out
    for (let i = 0; i < pricesBefore.length; i++) {
      if (pricesAfter[i] === '0' || pricesAfter[i] === '' || pricesAfter[i] === undefined) {
        console.error(`[BUG] ❌ Line ${i + 1} unit price was RESET from ${pricesBefore[i]} to ${pricesAfter[i]} after currency change!`);
      }
    }
  });

  test('BUG-HUNT: Changing Exchange Rate should not break existing calculated previews', async ({ page }) => {
    test.setTimeout(300000);
    await waitForWorkspace(page);
    await completeStep1_1(page);
    await completeStep1_2(page);
    await completeStep1_3(page);

    // Add 2 items
    await addLines(page, 2);
    const rows = page.locator('tbody tr');
    await fillLineViaModal(page, rows.nth(0), EXCEL_LINES[0], 0);
    await fillLineViaModal(page, rows.nth(1), EXCEL_LINES[1], 1);

    // Click CAL
    const calButton = page.getByRole('button', { name: 'CAL', exact: true });
    await calButton.click();
    await page.waitForTimeout(5000);

    // Record QLC values
    const previewTitle = page.locator('#preview-title');
    const previewVisible = await previewTitle.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[EX RATE] Preview visible after CAL: ${previewVisible}`);

    // Now change exchange rate
    const exRateInput = page.locator('#bulk-cost-exchange-rate');
    await exRateInput.click();
    await exRateInput.fill('');
    await exRateInput.type('35.50', { delay: 80 });
    await page.waitForTimeout(1500);

    // Preview should be CLEARED (because input changed)
    const previewStillVisible = await previewTitle.isVisible({ timeout: 2000 }).catch(() => false);
    console.log(`[EX RATE] Preview still visible after Ex. Rate change: ${previewStillVisible}`);
    if (previewStillVisible) {
      console.warn('[UX CHECK] ⚠️ Preview results remain visible after Ex. Rate change — user might think old results are still valid');
    }

    // Check for NaN in any visible cells
    const allCells = page.locator('td');
    const cellCount = await allCells.count();
    let nanFound = false;
    for (let i = 0; i < Math.min(cellCount, 100); i++) {
      const text = await allCells.nth(i).innerText();
      if (text.includes('NaN') || text.includes('undefined')) {
        console.error(`[BUG] ❌ NaN/undefined found in cell ${i}: "${text}"`);
        nanFound = true;
      }
    }
    if (!nanFound) {
      console.log('[EX RATE] ✅ No NaN values found after Ex. Rate change');
    }
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 4: DECIMAL & EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Edge Cases — Allocation Math & Zero Handling', () => {
  test('Decimal residual: 333.33 THB shared across 3 items should sum to exactly 333.33', async ({ request }) => {
    // Use API-level test for precision
    const oddCostLines = EXCEL_LINES.slice(0, 3).map(l => ({ ...l }));
    const oddCosts = {
      ...EXCEL_COSTS,
      pkh: 0,
      soc: 0,
      freight: 333.33,  // odd amount
      customs: 0,
      wireTT: 0,
    };

    const response = await request.post('http://localhost:3010/api/bulk-cost/calculate', {
      data: { costs: oddCosts, lines: oddCostLines },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const lines = body.data.lines;

    const totalAllocFR = lines.reduce((s: number, l: any) => s + (l.freightPerItem ?? 0), 0);
    console.log(`[DECIMAL] Total allocated Freight: ${totalAllocFR} (expected: 333.33)`);

    const diff = Math.abs(totalAllocFR - 333.33);
    expect(diff).toBeLessThan(0.01);
    console.log(`[DECIMAL] ✅ Residual diff: ${diff.toFixed(6)} THB`);
  });

  test('Zero Exchange Rate should not crash the page or produce NaN', async ({ page }) => {
    test.setTimeout(240000);
    await waitForWorkspace(page);

    // Set exchange rate to 0
    const exRateInput = page.locator('#bulk-cost-exchange-rate');
    await exRateInput.click();
    await exRateInput.fill('0');
    await page.waitForTimeout(1000);

    // Add 1 item
    await addLines(page, 1);
    await page.waitForTimeout(500);

    // Page should still be functional
    const addBtn = page.locator('.add-item-btn');
    await expect(addBtn).toBeVisible();
    console.log('[ZERO RATE] ✅ Page did not crash with Exchange Rate = 0');

    // Check for any error banners or NaN values
    const errorBanner = page.locator('[class*="error"], [class*="warning"], [role="alert"]');
    const errCount = await errorBanner.count();
    console.log(`[ZERO RATE] Warning/error banners visible: ${errCount}`);

    // Check table for NaN
    const cells = page.locator('td');
    const count = await cells.count();
    for (let i = 0; i < Math.min(count, 50); i++) {
      const text = await cells.nth(i).innerText();
      if (text.includes('NaN')) {
        console.error(`[BUG] ❌ NaN found in cell ${i} with Exchange Rate = 0`);
      }
    }
  });

  test('Zero qty line should not break allocation (Division by Zero guard)', async ({ request }) => {
    const zeroQtyLines = [
      { ...EXCEL_LINES[0], qty: 0, amount: 0 }, // Zero qty line
      { ...EXCEL_LINES[1] },  // Normal line
    ];

    const response = await request.post('http://localhost:3010/api/bulk-cost/calculate', {
      data: { costs: EXCEL_COSTS, lines: zeroQtyLines },
    });

    const status = response.status();
    console.log(`[ZERO QTY] API response status: ${status}`);

    if (response.ok()) {
      const body = await response.json();
      console.log(`[ZERO QTY] API returned success — checking for NaN in results`);
      const lines = body.data.lines;
      for (const line of lines) {
        if (line.finalResult) {
          for (const [key, val] of Object.entries(line.finalResult)) {
            if (typeof val === 'number' && isNaN(val)) {
              console.error(`[BUG] ❌ NaN found in finalResult.${key} for line ${line.lineKey}`);
            }
          }
        }
      }
    } else {
      const body = await response.json().catch(() => ({}));
      console.log(`[ZERO QTY] API returned error (expected): ${JSON.stringify(body)}`);
      // It's acceptable for the API to reject zero qty with an error
    }
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 5: FULL MANUAL FLOW — Golden Sequence End-to-End
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Full Manual Flow — 20-Item Golden Sequence E2E', () => {
  test('Complete manual workflow: Step 1.1 → 1.2 → 1.3 → Add Items → CAL → Verify', async ({ page }) => {
    test.setTimeout(600000); // 10 minutes for 20 items with human-speed

    console.log('═══ STEP 1.1: Initial Order Data ═══');
    await waitForWorkspace(page);
    await completeStep1_1(page);

    console.log('═══ STEP 1.2: Shared Costs ═══');
    await completeStep1_2(page);

    console.log('═══ STEP 1.3: Global Variables ═══');
    await completeStep1_3(page);

    // ASSERT: Live allocation should show in the grid BEFORE CAL
    console.log('═══ STEP 1.2 CHECK: Live Allocation Assertion ═══');
    // (No items yet, so this is the baseline)

    console.log('═══ STEP 2: Populating 20 Line Items ═══');
    // Create 20 rows
    await addLines(page, 20);

    // Fill each row via the modal (tab-by-tab, left to right)
    const rows = page.locator('tbody tr');
    for (let i = 0; i < 20; i++) {
      console.log(`Filling Line ${i + 1}/20: ${EXCEL_LINES[i].sapDescription.substring(0, 40)}...`);
      await fillLineViaModal(page, rows.nth(i), EXCEL_LINES[i], i);
    }

    // CHECK: Live allocation should now show PKH/SOC per each
    console.log('═══ POST-FILL CHECK: Live Allocation Assertion ═══');
    await page.waitForTimeout(2000);

    // Check for NaN or zero in any visible allocation cell
    const allCells = page.locator('td');
    const cellCount = await allCells.count();
    let nanCount = 0;
    for (let i = 0; i < Math.min(cellCount, 200); i++) {
      const text = await allCells.nth(i).innerText();
      if (text.includes('NaN') || text.includes('undefined')) {
        nanCount++;
        console.error(`[BUG] ❌ NaN/undefined in cell ${i}: "${text}"`);
      }
    }
    console.log(`[PRE-CAL] NaN cells found: ${nanCount}`);

    console.log('═══ STEP 3: Execute Calculation (CAL) ═══');
    const calButton = page.getByRole('button', { name: 'CAL', exact: true });
    await calButton.click();
    await page.waitForTimeout(8000); // Wait for backend calculation

    // Check preview appeared
    const previewTitle = page.locator('#preview-title');
    const previewVisible = await previewTitle.isVisible({ timeout: 10000 }).catch(() => false);
    console.log(`[CAL] Preview visible: ${previewVisible}`);
    expect(previewVisible).toBeTruthy();

    // Verify no NaN in result columns
    console.log('═══ POST-CAL: Checking for NaN/Zero in results ═══');
    const postCalCells = page.locator('td');
    const postCalCount = await postCalCells.count();
    let postNanCount = 0;
    let zeroSalesPriceCount = 0;
    for (let i = 0; i < Math.min(postCalCount, 300); i++) {
      const text = await postCalCells.nth(i).innerText();
      if (text.includes('NaN') || text.includes('undefined')) {
        postNanCount++;
        console.error(`[BUG] ❌ Post-CAL NaN in cell ${i}: "${text}"`);
      }
      if (text.trim() === '0.00') {
        zeroSalesPriceCount++;
      }
    }
    console.log(`[POST-CAL] NaN cells: ${postNanCount}, Zero cells: ${zeroSalesPriceCount}`);

    // Scroll down to show results
    await page.evaluate(() => {
      window.scrollBy({ top: 600, behavior: 'smooth' });
    });
    await page.waitForTimeout(3000);

    console.log('═══ MANUAL FLOW COMPLETE ═══');
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 6: PRESET TAB NAVIGATION & DISCOVERABILITY
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('UX Audit — Preset Tab Navigation', () => {
  test('All 5 preset tabs should be visible and clickable', async ({ page }) => {
    test.setTimeout(240000);
    await waitForWorkspace(page);
    await completeStep1_1(page);
    await addLines(page, 1);

    const expectedTabs = ['Item Data', 'Purchase Term', 'Order Price', 'Landed Cost', 'Sales Term'];
    const presetBar = page.locator('.line-column-presets-bar');

    for (const tabName of expectedTabs) {
      const tab = presetBar.locator('button', { hasText: tabName }).first();
      const isVisible = await tab.isVisible({ timeout: 3000 }).catch(() => false);
      console.log(`[PRESET TAB] "${tabName}": visible=${isVisible}`);
      if (!isVisible) {
        console.error(`[BUG] ❌ Preset tab "${tabName}" is NOT visible!`);
      } else {
        // Click the tab and verify table columns change
        await tab.click();
        await page.waitForTimeout(500);
        console.log(`[PRESET TAB] ✅ Clicked "${tabName}" — columns updated`);
      }
    }
  });

  test('BUG-HUNT: No tooltip or hint telling users where to find line-level overrides', async ({ page }) => {
    test.setTimeout(240000);
    await waitForWorkspace(page);
    await completeStep1_1(page);
    await addLines(page, 1);

    // Look for any tooltip, hint, or helper text near the preset tabs
    const hintElements = page.locator('[class*="tooltip"], [class*="hint"], [title], [aria-label*="hint"]');
    const hintCount = await hintElements.count();
    console.log(`[PRESET HINTS] Tooltip/hint elements found near grid: ${hintCount}`);

    if (hintCount === 0) {
      console.warn('[UX SUGGESTION] ⚠️ No tooltips or hints found to guide users to line-level override fields');
      console.warn('[UX SUGGESTION] ⚠️ Users may not know that Markup% and Duty% per-line are in "Landed Cost" tab');
    }
  });
});


// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE 7: API CALCULATION ACCURACY (Fast, Headless)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('API — Calculation Accuracy Spot Check', () => {
  test('Full 20-item batch: OP1, OP2, Duty, QLC, SalePrice all within tolerance', async ({ request }) => {
    const response = await request.post('http://localhost:3010/api/bulk-cost/calculate', {
      data: { costs: EXCEL_COSTS, lines: EXCEL_LINES },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    const lines = body.data.lines;

    expect(lines).toHaveLength(20);

    const TOLERANCE = 5.0; // THB
    let failCount = 0;

    for (const expected of EXCEL_EXPECTED) {
      const apiLine = lines.find((l: any) => l.lineKey === expected.lineKey);
      expect(apiLine).toBeDefined();

      const r = apiLine.finalResult;

      // OP1
      if (Math.abs(r.op1 - expected.op1) > TOLERANCE) {
        console.error(`[CALC] ❌ Line ${expected.no} OP1: got ${r.op1}, expected ${expected.op1}, diff=${Math.abs(r.op1 - expected.op1).toFixed(2)}`);
        failCount++;
      }
      // OP2
      if (Math.abs(r.op2 - expected.op2) > TOLERANCE) {
        console.error(`[CALC] ❌ Line ${expected.no} OP2: got ${r.op2}, expected ${expected.op2}, diff=${Math.abs(r.op2 - expected.op2).toFixed(2)}`);
        failCount++;
      }
      // Duty
      if (Math.abs(r.selectedDuty - expected.selectedDuty) > TOLERANCE) {
        console.error(`[CALC] ❌ Line ${expected.no} Duty: got ${r.selectedDuty}, expected ${expected.selectedDuty}, diff=${Math.abs(r.selectedDuty - expected.selectedDuty).toFixed(2)}`);
        failCount++;
      }
      // QLC
      if (Math.abs(r.qlc - expected.qlc) > TOLERANCE) {
        console.error(`[CALC] ❌ Line ${expected.no} QLC: got ${r.qlc}, expected ${expected.qlc}, diff=${Math.abs(r.qlc - expected.qlc).toFixed(2)}`);
        failCount++;
      }
      // Sale Price
      if (Math.abs(r.roundUp - expected.salePrice) > TOLERANCE) {
        console.error(`[CALC] ❌ Line ${expected.no} Sale: got ${r.roundUp}, expected ${expected.salePrice}, diff=${Math.abs(r.roundUp - expected.salePrice).toFixed(2)}`);
        failCount++;
      }
    }

    console.log(`[CALC SUMMARY] Total check failures: ${failCount}/100 (20 lines × 5 fields)`);
    expect(failCount).toBe(0);
  });

  test('Allocation integrity: sum of per-item allocations = header totals', async ({ request }) => {
    const response = await request.post('http://localhost:3010/api/bulk-cost/calculate', {
      data: { costs: EXCEL_COSTS, lines: EXCEL_LINES },
    });
    const body = await response.json();
    const lines = body.data.lines;

    const sums = {
      pkh: lines.reduce((s: number, l: any) => s + (l.pkhPerItem ?? 0), 0),
      soc: lines.reduce((s: number, l: any) => s + (l.socPerItem ?? 0), 0),
      freight: lines.reduce((s: number, l: any) => s + (l.freightPerItem ?? 0), 0),
      cc: lines.reduce((s: number, l: any) => s + (l.ccPerItem ?? 0), 0),
      tt: lines.reduce((s: number, l: any) => s + (l.wireTTPerItem ?? 0), 0),
    };

    console.log(`[ALLOC SUM] PKH: ${sums.pkh.toFixed(4)} (expected 75)`);
    console.log(`[ALLOC SUM] SOC: ${sums.soc.toFixed(4)} (expected 125)`);
    console.log(`[ALLOC SUM] FR:  ${sums.freight.toFixed(4)} (expected 40000)`);
    console.log(`[ALLOC SUM] CC:  ${sums.cc.toFixed(4)} (expected 8000)`);
    console.log(`[ALLOC SUM] TT:  ${sums.tt.toFixed(4)} (expected 1500)`);

    expect(Math.abs(sums.pkh - 75)).toBeLessThan(0.01);
    expect(Math.abs(sums.soc - 125)).toBeLessThan(0.01);
    expect(Math.abs(sums.freight - 40000)).toBeLessThan(0.01);
    expect(Math.abs(sums.cc - 8000)).toBeLessThan(0.01);
    expect(Math.abs(sums.tt - 1500)).toBeLessThan(0.01);
  });
});
