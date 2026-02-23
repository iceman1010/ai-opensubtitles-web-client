import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:5173',
    headless: true,
  },
  projects: [
    {
      name: 'production',
      use: {
        baseURL: 'https://ai.opensubtitles.com/ai-web/',
      },
    },
    {
      name: 'development',
      use: {
        baseURL: 'http://localhost:5173',
      },
    },
  ],
});
