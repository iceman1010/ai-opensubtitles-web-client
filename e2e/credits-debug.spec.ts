import { test, expect } from '@playwright/test';

test.use({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

test('debug: check why credits not showing', async ({ page }) => {
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error' || text.includes('credits') || text.includes('API') || text.includes('Failed')) {
      console.log(`[${msg.type()}] ${text}`);
    }
  });

  page.on('pageerror', err => {
    console.log(`[PAGE ERROR] ${err.message}`);
  });

  // Clear storage to simulate fresh state
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto('/ai-web/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Fill login
  const inputs = page.locator('input');
  await inputs.nth(0).fill('iceman_1111');
  await inputs.nth(1).fill('67uYF7qsFBZGTa8');
  await page.locator('button').click();

  // Wait for login to complete
  await page.waitForTimeout(8000);

  // Check page state
  const bodyText = await page.locator('body').textContent();
  console.log('\n=== Page content after login ===');
  console.log(bodyText?.substring(0, 1000));

  // Look for credits in the page
  const hasCredits = bodyText?.includes('credits') || bodyText?.includes('Credits');
  console.log('\nCredits visible:', hasCredits);

  // Try navigating to credits screen
  await page.goto('/ai-web/?screen=credits');
  await page.waitForTimeout(5000);

  const creditsPage = await page.locator('body').textContent();
  console.log('\n=== Credits page ===');
  console.log(creditsPage?.substring(0, 800));

  // Check console for API errors
  console.log('\n=== All console logs ===');
  consoleLogs.forEach(log => console.log(log));
});
