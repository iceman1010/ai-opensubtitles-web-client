import { test } from '@playwright/test';

test('login without custom userAgent', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', msg => messages.push(`[${msg.type()}] ${msg.text()}`));
  
  await page.goto('https://ai.opensubtitles.com/ai-web/');
  await page.waitForLoadState('networkidle');
  
  await page.locator('input').first().fill('testuser');
  await page.locator('input').nth(1).fill('testpass');
  await page.locator('button').click();
  
  await page.waitForTimeout(5000);
  
  console.log(messages.join('\n'));
});
