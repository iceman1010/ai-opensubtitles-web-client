import { test, expect } from '@playwright/test';

test('capture browser request headers', async ({ page }) => {
  const requests: { url: string; method: string; headers: Record<string, string> }[] = [];
  
  await page.route('**/api/v1/**', async route => {
    const req = route.request();
    requests.push({
      url: req.url(),
      method: req.method(),
      headers: req.headers()
    });
    await route.continue();
  });
  
  await page.goto('https://ai.opensubtitles.com/ai-web/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  
  await page.locator('input').first().fill('testuser');
  await page.locator('input').nth(1).fill('testpass');
  await page.locator('button').click();
  
  await page.waitForTimeout(5000);
  
  console.log('=== BROWSER REQUESTS ===');
  for (const req of requests) {
    console.log(`\n${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
  }
});
