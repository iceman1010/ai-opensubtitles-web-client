import { test, expect } from '@playwright/test';

test.use({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

test('should display credits balance', async ({ page }) => {
  // Go directly to credits - user should already be logged in via localStorage
  await page.goto('/ai-web/?screen=credits');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const bodyText = await page.locator('body').textContent();
  console.log('Credits page content:');
  console.log(bodyText);

  // Check if credits are visible
  if (bodyText?.includes('Credits') || bodyText?.includes('credits')) {
    console.log('✓ Credits section found');
  }

  // Also check main screen
  await page.goto('/ai-web/');
  await page.waitForTimeout(2000);
  
  const mainText = await page.locator('body').textContent();
  console.log('\nMain page content:');
  console.log(mainText?.substring(0, 500));
});
