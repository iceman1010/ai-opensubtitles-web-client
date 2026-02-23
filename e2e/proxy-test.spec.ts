import { test, expect } from '@playwright/test';

test('test proxy', async ({ page }) => {
  await page.goto('https://ai.opensubtitles.com/ai-web/test-proxy.html');
  await page.waitForTimeout(3000);
  console.log('Output:', await page.locator('#output').textContent());
});
