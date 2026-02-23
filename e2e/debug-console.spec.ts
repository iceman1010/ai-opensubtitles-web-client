import { test, expect } from '@playwright/test';

test.use({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

test('fresh browser, fresh login', async ({ browser }) => {
  // Create fresh context - no shared state
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const logs: string[] = [];
  
  page.on('console', msg => {
    console.log(`${msg.type()}: ${msg.text()}`);
    logs.push(`${msg.type()}: ${msg.text()}`);
  });

  await page.goto('/ai-web/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('Page loaded, checking for login form...');

  // Check if login form is visible
  const loginForm = page.locator('form');
  const isVisible = await loginForm.isVisible();
  console.log('Login form visible:', isVisible);
  
  // Fill in credentials
  const inputs = page.locator('input');
  await inputs.nth(0).fill('iceman_1111');
  await inputs.nth(1).fill('67uYF7qsFBZGTa8');
  
  // Click login
  console.log('Clicking login...');
  await page.locator('button[type="submit"]').click();
  
  await page.waitForTimeout(10000);
  
  const bodyText = await page.locator('body').textContent();
  console.log('\n=== BODY ===');
  console.log(bodyText?.substring(0, 800));
  
  if (bodyText?.includes('Credits:')) {
    console.log('\n✓ SUCCESS');
  } else if (bodyText?.includes('Too many login')) {
    console.log('\n⚠ RATE LIMITED');
  } else {
    console.log('\n? OTHER');
  }
  
  await context.close();
});
