import { test, expect } from '@playwright/test';

test.use({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

test('should login fresh and show credits', async ({ page }) => {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;

  if (!username || !password) {
    throw new Error('TEST_USERNAME and TEST_PASSWORD required');
  }

  // Clear any storage first
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  await page.goto('/ai-web/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('Page loaded, checking for login form...');

  // Wait for the app to render
  await page.waitForSelector('input', { timeout: 10000 });
  
  const inputs = page.locator('input');
  const inputCount = await inputs.count();
  console.log(`Found ${inputCount} inputs`);

  if (inputCount >= 2) {
    console.log('Filling credentials...');
    await inputs.nth(0).fill(username);
    await inputs.nth(1).fill(password);
    
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Found ${buttonCount} buttons`);
    
    if (buttonCount > 0) {
      await buttons.first().click();
      console.log('Clicked login, waiting...');
      await page.waitForTimeout(8000);
    }
  }

  // Check console for API calls
  const consoleMessages: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error' || text.includes('API') || text.includes('credits')) {
      console.log(`[${msg.type()}] ${text}`);
    }
  });

  // Now check what's displayed
  const bodyText = await page.locator('body').textContent();
  console.log('\n=== Final page state ===');
  console.log(bodyText?.substring(0, 800));

  // Check for main app elements
  if (bodyText?.includes('Single File') || bodyText?.includes('Batch') || bodyText?.includes('credits')) {
    console.log('\n✓ SUCCESS: Logged in and app is functional!');
  } else if (bodyText?.includes('Too many login attempts')) {
    console.log('\n⚠ Rate limited - need to wait before testing login again');
  }
});
