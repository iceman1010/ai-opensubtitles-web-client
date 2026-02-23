import { test } from '@playwright/test';

test('check ua', async ({ page }) => {
  await page.goto('https://ai.opensubtitles.com/ai-web/test-ua2.html');
  await page.waitForTimeout(3000);
  console.log(await page.locator('pre').textContent());
});
