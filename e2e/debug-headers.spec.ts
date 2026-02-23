import { test } from '@playwright/test';

test('debug headers', async ({ page }) => {
  await page.goto('https://ai.opensubtitles.com/ai-web/test-debug.html');
  await page.waitForTimeout(3000);
  console.log(await page.locator('pre').textContent());
});
