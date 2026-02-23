import { test, expect } from '@playwright/test';

test.use({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

test('should login and check credits', async ({ page }) => {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;

  if (!username || !password) {
    throw new Error('TEST_USERNAME and TEST_PASSWORD environment variables required');
  }

  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page.goto('/ai-web/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('Filling login form...');
  
  // Fill login - there are 3 inputs (username, password, and maybe one more)
  const inputs = page.locator('input');
  await inputs.nth(0).fill(username);
  await inputs.nth(1).fill(password);
  
  // Click the login button
  await page.locator('button').click();
  
  console.log('Login clicked, waiting for response...');
  await page.waitForTimeout(5000);

  // Check for errors
  console.log('Console errors:', errors);

  // Check if we're logged in - look for main app elements
  const pageText = await page.locator('body').textContent();
  console.log('Page content after login:', pageText?.substring(0, 500));

  // Try to navigate to credits
  await page.goto('/ai-web/?screen=credits');
  await page.waitForTimeout(3000);
  
  const creditsText = await page.locator('body').textContent();
  console.log('Credits page:', creditsText?.substring(0, 300));
});
