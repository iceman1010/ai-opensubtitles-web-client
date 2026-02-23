import { test, expect } from '@playwright/test';

test.use({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

test('debug: test with real token', async ({ page }) => {
  const logs: string[] = [];
  
  page.on('console', msg => {
    console.log(`CONSOLE: ${msg.text()}`);
    logs.push(msg.text());
  });

  await page.goto('/ai-web/');
  await page.waitForLoadState('networkidle');
  
  // Inject REAL credentials and REAL token
  await page.addInitScript(() => {
    localStorage.setItem('ai_opensubtitles_config', JSON.stringify({
      username: 'iceman_1111',
      password: '67uYF7qsFBZGTa8',
      apiKey: 'YzhaGkIg6dMSJ47QoihkhikfRmvbJTn7'
    }));
    // REAL TOKEN
    localStorage.setItem('ai_opensubtitles_token', 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJPWUxrQ2tndHVQaVpzTTQ2UzJrbXVBWW9ickhTdVZtNCIsImV4cCI6MTc3MTg2NDU2OX0.NMMKaPfnduqfmfI6fNObWl44WWmKBVjiad7bhKWhO2U');
    localStorage.setItem('ai_opensubtitles_token_expiry', String(Date.now() + 3600000));
  });
  
  console.log('Injected REAL credentials, reloading...');
  
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(8000);
  
  // Check what's displayed
  const bodyText = await page.locator('body').textContent();
  console.log('\n=== BODY TEXT ===');
  console.log(bodyText?.substring(0, 1000));
  
  // Look for credits
  if (bodyText?.includes('Credits') || bodyText?.includes('credits')) {
    console.log('\n✓ SUCCESS: Credits found!');
  } else {
    console.log('\n✗ FAILED: No credits displayed');
  }
});
