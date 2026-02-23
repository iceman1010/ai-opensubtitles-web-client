import { test, expect } from '@playwright/test';

test('debug API calls', async ({ page }) => {
  const messages: string[] = [];
  page.on('console', msg => messages.push(`[${msg.type()}] ${msg.text()}`));
  page.on('request', req => messages.push(`→ ${req.method()} ${req.url()}`));
  page.on('response', res => messages.push(`← ${res.status()} ${res.url()}`));
  
  await page.goto('https://ai.opensubtitles.com/ai-web/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  await page.locator('input').first().fill('testuser');
  await page.locator('input').nth(1).fill('testpass');
  await page.locator('button').click();
  
  await page.waitForTimeout(5000);
  
  console.log(messages.join('\n'));
});
