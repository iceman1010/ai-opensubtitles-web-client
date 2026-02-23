import { test, expect } from '@playwright/test';

test.use({
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

test('debug: capture console logs on page load', async ({ page }) => {
  const consoleLogs: string[] = [];
  
  page.on('console', msg => {
    const text = msg.text();
    consoleLogs.push(`[${msg.type()}] ${text}`);
  });

  page.on('pageerror', err => {
    consoleLogs.push(`[PAGE ERROR] ${err.message}`);
  });

  await page.goto('/ai-web/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(8000);

  console.log('\n=== CONSOLE LOGS ===');
  consoleLogs.forEach(log => console.log(log));
  console.log('=== END LOGS ===\n');
});
