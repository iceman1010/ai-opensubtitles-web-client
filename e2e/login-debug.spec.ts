import { test, expect } from '@playwright/test';

test('debug login - capture full request/response cycle', async ({ page }) => {
  const username = process.env.TEST_USERNAME;
  const password = process.env.TEST_PASSWORD;

  if (!username || !password) {
    throw new Error('TEST_USERNAME and TEST_PASSWORD env vars required');
  }

  // Capture all console messages
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
  });

  // Capture all network requests/responses to the API
  const apiCalls: { url: string; method: string; reqHeaders: Record<string, string>; status: number; resHeaders: Record<string, string>; body: string }[] = [];

  page.on('request', req => {
    if (req.url().includes('opensubtitles') || req.url().includes('/api/')) {
      console.log(`\n>>> REQUEST: ${req.method()} ${req.url()}`);
      const headers = req.headers();
      console.log('Request headers:');
      for (const [k, v] of Object.entries(headers)) {
        console.log(`  ${k}: ${v}`);
      }
    }
  });

  page.on('response', async res => {
    if (res.url().includes('opensubtitles') || res.url().includes('/api/')) {
      console.log(`\n<<< RESPONSE: ${res.status()} ${res.url()}`);
      const headers = res.headers();
      console.log('Response headers:');
      for (const [k, v] of Object.entries(headers)) {
        console.log(`  ${k}: ${v}`);
      }
      try {
        const body = await res.text();
        console.log('Response body:', body.substring(0, 1000));
        apiCalls.push({
          url: res.url(),
          method: res.request().method(),
          reqHeaders: res.request().headers(),
          status: res.status(),
          resHeaders: headers,
          body: body.substring(0, 1000),
        });
      } catch {
        console.log('(could not read response body)');
      }
    }
  });

  // Clear storage to force fresh login
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  console.log('=== Step 1: Navigate to app ===');
  await page.goto('/ai-web/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  // Verify we're on the login screen
  const bodyText = await page.locator('body').textContent();
  console.log('\n=== Page text (first 300 chars) ===');
  console.log(bodyText?.substring(0, 300));

  // Check for login form
  const usernameInput = page.locator('#username');
  const passwordInput = page.locator('#password');
  await expect(usernameInput).toBeVisible({ timeout: 10000 });
  await expect(passwordInput).toBeVisible();

  console.log('\n=== Step 2: Fill credentials and submit ===');
  await usernameInput.fill(username);
  await passwordInput.fill(password);

  const loginButton = page.locator('button[type="submit"]');
  await expect(loginButton).toBeEnabled();
  await loginButton.click();

  console.log('Clicked login, waiting for API response...');
  await page.waitForTimeout(10000);

  // Check final state
  console.log('\n=== Step 3: Final state ===');
  const finalText = await page.locator('body').textContent();
  console.log('Page text (first 500 chars):');
  console.log(finalText?.substring(0, 500));

  // Summary
  console.log('\n=== API Call Summary ===');
  console.log(`Total API calls captured: ${apiCalls.length}`);
  for (const call of apiCalls) {
    console.log(`\n${call.method} ${call.url}`);
    console.log(`  Status: ${call.status}`);
    console.log(`  X-User-Agent sent: ${call.reqHeaders['x-user-agent'] || 'NOT PRESENT'}`);
    console.log(`  User-Agent sent: ${call.reqHeaders['user-agent'] || 'NOT PRESENT'}`);
    console.log(`  Body: ${call.body.substring(0, 200)}`);
  }

  // Check if login succeeded
  const isLoggedIn = finalText?.includes('credits') || finalText?.includes('Single File') || finalText?.includes('Batch');
  const hasError = finalText?.includes('error') || finalText?.includes('failed') || finalText?.includes('Too many');
  console.log(`\nLogin succeeded: ${isLoggedIn}`);
  console.log(`Has error: ${hasError}`);

  console.log('\n=== Console logs ===');
  for (const log of consoleLogs) {
    console.log(log);
  }
});
