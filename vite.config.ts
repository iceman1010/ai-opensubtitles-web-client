import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2020',
  },
  server: {
    port: 5174,
    headers: {
      // Required for SharedArrayBuffer (FFmpeg multi-threading)
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    proxy: {
      '/api/v1': {
        target: 'https://api.opensubtitles.com',
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            // API requires User-Agent — browsers block setting it via fetch,
            // so the proxy injects it server-side
            proxyReq.setHeader('User-Agent', 'API_Test_AI.OS_Web');
          });
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/main.tsx'],
    },
  },
});
