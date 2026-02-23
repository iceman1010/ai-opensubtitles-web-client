import { test } from '@playwright/test';

test('login without custom userAgent', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', msg => messages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('request', req => {
    if (req.url().includes('api-log')) {
      console.log('REQUEST:', req.method(), req.url());
    }
  });
  page.on('response', res => {
    if (res.url().includes('api-log')) {
      console.log('RESPONSE:', res.status(), res.url());
    }
  });
  
  await page.goto('https://ai.opensubtitles.com/ai-web/');
  await page.waitForLoadState('networkidle');
  
  console.log('Page loaded, filling credentials...');
  
  await page.locator('input').first().fill('testuser');
  await page.locator('input').nth(1).fill('testpass');
  await page.locator('button').click();
  
  console.log('Clicked login, waiting...');
  await page.waitForTimeout(8000);
  
  console.log('All console messages:');
  console.log(messages.join('\n'));
});
