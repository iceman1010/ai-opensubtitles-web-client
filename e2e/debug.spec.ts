import { test, expect } from '@playwright/test';

test.use({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  locale: 'en-US',
});

test('should login to web app', async ({ page }) => {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;

  await page.goto('/ai-web/');
  
  // Wait for JavaScript to load
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Check what's visible
  console.log('Page title:', await page.title());
  
  // Try to find any form elements
  const buttons = await page.locator('button').count();
  console.log('Buttons found:', buttons);
  
  const inputs = await page.locator('input').count();
  console.log('Inputs found:', inputs);

  // Check for errors in console
  page.on('console', msg => console.log(`[${msg.type()}] ${msg.text()}`));
});
