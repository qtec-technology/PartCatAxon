import { test, expect } from '@playwright/test';
import { EXCEL_LINES } from './fixtures/excel-test-data';

test.describe('Manual Cost Workspace Visual Walkthrough', () => {
  test('should run the manual cost workspace flow step-by-step in slow-motion', async ({ page }) => {
    // Increase test timeout to 10 minutes to accommodate the visual workflow for 20 items on slower environments
    test.setTimeout(600000);

    // Automatically accept any confirmation dialogs (window.confirm) that appear
    page.on('dialog', async (dialog) => {
      console.log(`[E2E DIALOG] Automatically accepting dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    // 1. Navigate to the Bulk Cost page with Grainger as supplier
    console.log('Step 1: Navigating to manual cost workspace page for Grainger...');
    await page.goto('/bulk-cost?tab=new&supplier=V-GRA-001&supplierName=Grainger');
    await page.waitForTimeout(3000); // Wait for page loading

    // Verify workspace is visible
    const workspace = page.locator('[class*="workspace"], [class*="cost-workspace"]').first();
    await expect(workspace).toBeVisible();

    // 2. Complete Card 1.1 first (Initial Order Data) as per proper workflow
    console.log('Step 2: Completing Card 1.1 Order Data first...');

    // Select Currency (foreign currency) - must trigger auto-filling ex.rate
    console.log('Selecting Currency (USD)...');
    await page.locator('#bulk-cost-currency').click();
    await page.waitForTimeout(1000);
    // Locate option containing USD or US Dollar
    await page.locator('[role="option"]:has-text("USD"), [role="option"]:has-text("US Dollar")').first().click();
    await page.waitForTimeout(1500);

    // Verify ex.rate is auto-filled (or wait to show the auto-filled value)
    const exRateInput = page.locator('#bulk-cost-exchange-rate');
    await expect(exRateInput).toHaveValue(/^[0-9.]+/); // verify it contains a number
    console.log('Exchange rate auto-populated successfully!');

    // Select Order Term: Exwork
    console.log('Selecting Order Term (Exwork)...');
    await page.locator('#bulk-cost-order-term').click();
    await page.waitForTimeout(1000);
    await page.locator('[role="option"]:has-text("Exwork")').first().click();
    await page.waitForTimeout(1500);

    // Select Location: US (United States)
    console.log('Selecting Location (US/United States)...');
    await page.locator('#bulk-cost-location').click();
    await page.waitForTimeout(1000);
    await page.locator('[role="option"]:has-text("United States"), [role="option"]:has-text("US")').first().click();
    await page.waitForTimeout(1500);

    // Select Sub Location (first option)
    console.log('Selecting Sub Location...');
    await page.locator('#bulk-cost-sub-location').click();
    await page.waitForTimeout(1000);
    // Click the first option that appears in the dropdown list
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(1500);

    // Select Ship Mode: Air COUR (Air Courier)
    console.log('Selecting Ship Mode (Air COUR)...');
    await page.locator('#bulk-cost-ship-mode').click();
    await page.waitForTimeout(1000);
    await page.locator('[role="option"]:has-text("Air COUR"), [role="option"]:has-text("6")').first().click();
    await page.waitForTimeout(1500);

    // Click "Apply Order Settings to All" to ensure all rows inherit these settings
    console.log('Applying order settings to all lines...');
    await page.locator('.cost-bar-apply-defaults').first().click();
    await page.waitForTimeout(2000);

    // 3. Input global shared costs in Card 1.2
    console.log('Step 3: Entering global shared costs in Card 1.2...');

    // PKH Cost (USD)
    const pkhInput = page.locator('#bulk-cost-pkh');
    await pkhInput.click();
    await pkhInput.fill('');
    await page.waitForTimeout(1000);
    await pkhInput.type('75', { delay: 50 });
    await page.waitForTimeout(1000);

    // SOC Cost (USD)
    const socInput = page.locator('#bulk-cost-soc');
    await socInput.click();
    await socInput.fill('');
    await page.waitForTimeout(1000);
    await socInput.type('125', { delay: 50 });
    await page.waitForTimeout(1000);

    // Freight (THB)
    const freightInput = page.locator('#bulk-cost-freight');
    await freightInput.click();
    await freightInput.fill('');
    await page.waitForTimeout(1000);
    await freightInput.type('40000', { delay: 50 });
    await page.waitForTimeout(1000);

    // Customs clearance (THB)
    const customsInput = page.locator('#bulk-cost-customs');
    await customsInput.click();
    await customsInput.fill('');
    await page.waitForTimeout(1000);
    await customsInput.type('8000', { delay: 50 });
    await page.waitForTimeout(1000);

    // Wire TT (THB)
    const wireTTInput = page.locator('#bulk-cost-wireTT');
    await wireTTInput.click();
    await wireTTInput.fill('');
    await page.waitForTimeout(1000);
    await wireTTInput.type('1500', { delay: 50 });
    await page.waitForTimeout(1500);

    // 4. Input global variables in Card 1.3 (Global Variables)
    console.log('Step 4: Entering global variables in Card 1.3...');

    const insInput = page.locator('#bulk-cost-default-ins');
    await insInput.click();
    await insInput.fill('');
    await page.waitForTimeout(500);
    await insInput.type('1', { delay: 50 });

    const dutyInput = page.locator('#bulk-cost-default-duty');
    await dutyInput.click();
    await dutyInput.fill('');
    await page.waitForTimeout(500);
    await dutyInput.type('10', { delay: 50 });

    const stkInput = page.locator('#bulk-cost-default-stk');
    await stkInput.click();
    await stkInput.fill('');
    await page.waitForTimeout(500);
    await stkInput.type('0', { delay: 50 });

    const spkInput = page.locator('#bulk-cost-default-spk');
    await spkInput.click();
    await spkInput.fill('');
    await page.waitForTimeout(500);
    await spkInput.type('0', { delay: 50 });

    const qocInput = page.locator('#bulk-cost-default-qoc');
    await qocInput.click();
    await qocInput.fill('');
    await page.waitForTimeout(500);
    await qocInput.type('0', { delay: 50 });

    const markupInput = page.locator('#bulk-cost-default-markup');
    await markupInput.click();
    await markupInput.fill('');
    await page.waitForTimeout(500);
    await markupInput.type('10', { delay: 50 });
    await page.waitForTimeout(1000);

    // Click "Apply to All Items" under Card 1.3
    console.log('Applying global defaults to all items...');
    await page.locator('button:has-text("Apply to All Items")').first().click();
    await page.waitForTimeout(2000);

    // 5. Populate all 20 lines in the manual workspace
    console.log('Step 5: Creating 20 items in the workspace table...');
    // Click "+ Add Item" 19 times to create 20 rows (first row exists by default)
    for (let i = 0; i < 19; i++) {
      await page.locator('.add-item-btn').click();
    }
    await page.waitForTimeout(2000);

    console.log('Filling details for all 20 items using the edit modal tab-by-tab from left to right (Fast Entry)...');
    const rows = page.locator('tbody tr');
    for (let i = 0; i < 20; i++) {
      const row = rows.nth(i);
      const data = EXCEL_LINES[i];

      console.log(`Filling Line ${i + 1} of 20...`);

      // Double click row to open modal (opens to default "Item Data" tab)
      await row.dblclick();
      await page.waitForTimeout(500); // Wait for modal

      // Tab 1: Item Data (Default) - Fill Brand, Part Number, Description
      // Fill the actual brand from excel, then click the matched suggestion
      const brandInput = page.locator('.line-edit-modal-field:has(label:has-text("Mfr Brand")) input').first();
      await brandInput.click();
      await page.waitForTimeout(100);
      await brandInput.fill(data.manufacturer);
      await page.waitForTimeout(300);
      const brandOption = page.locator('.searchable-lookup-option').first();
      if (await brandOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await brandOption.click();
      }

      // Fill Mfr Catalog No
      await page.locator('.line-edit-modal-field:has(label:has-text("Mfr Catalog No")) input').first().fill(data.mfgPartNumber);

      // Fill Item Description
      await page.locator('.line-edit-modal-field:has(label:has-text("Item Description")) textarea').first().fill(data.sapDescription);

      // Click Country of Origin dropdown trigger and choose the first suggestion
      await page.locator('.line-edit-modal-field:has(label:has-text("Country of Origin")) input').first().click();
      await page.waitForTimeout(100);
      const cooOption = page.locator('.searchable-lookup-option').first();
      if (await cooOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cooOption.click();
      }

      // Tab 2: Purchase Term - Fill Chargeable Weight
      const modalTabs = page.locator('.line-edit-modal-tabs');
      await modalTabs.locator('button', { hasText: 'Purchase Term' }).first().click();
      await page.waitForTimeout(150);
      await page.locator('.line-edit-modal-field:has(label:has-text("Chargeable Wt/Ea")) input').first().fill(String(data.shippingWeightPerEach));

      // Tab 3: Order Price - Fill Qty and Unit Price
      await modalTabs.locator('button', { hasText: 'Order Price' }).first().click();
      await page.waitForTimeout(150);
      await page.locator('.line-edit-modal-field:has(label:has-text("Qty")) input').first().fill(String(data.qty));
      await page.locator('.line-edit-modal-field:has(label:has-text("Unit Price")) input').first().fill(String(data.unitPrice));

      // Tab 4: Landed Cost - Fill Duty % (for line 13: 0% duty, for others just show it)
      await modalTabs.locator('button', { hasText: 'Landed Cost' }).first().click();
      await page.waitForTimeout(150);
      if (i === 12) {
        await page.locator('.line-edit-modal-field:has(label:has-text("Duty %")) input').first().fill('0');
        await page.waitForTimeout(150);
      }

      // Tab 5: Sales Term - Just show it
      await modalTabs.locator('button', { hasText: 'Sales Term' }).first().click();
      await page.waitForTimeout(150);

      // Close modal
      await page.locator('.line-edit-modal-close').click();
      await page.waitForTimeout(300); // wait for modal to close
    }
    await page.waitForTimeout(2000);

    // 6. Trigger calculation by clicking the CAL button
    console.log('Step 6: Executing calculation (CAL)...');
    const calButton = page.getByRole('button', { name: 'CAL', exact: true });
    await calButton.click();
    await page.waitForTimeout(5000); // Wait for calculation

    // 7. View final results
    console.log('Step 7: Reviewing calculated QLC & Landed Cost results...');
    const resultTitle = page.locator('#preview-title');
    await expect(resultTitle).toBeVisible();

    // Scroll down slowly to show the results table
    await page.evaluate(() => {
      window.scrollBy({ top: 400, behavior: 'smooth' });
    });
    await page.waitForTimeout(10000); // Stay visible for 10 seconds

    console.log('Walkthrough completed successfully!');
  });
});
