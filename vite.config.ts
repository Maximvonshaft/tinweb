import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteMockServe } from 'vite-plugin-mock';

export default defineConfig(({ command }) => {
  const enableMock = process.env.ENABLE_MOCK === '1';
  const backendTarget = process.env.BACKEND_URL ?? 'http://localhost:8787';

  return {
    base: command === 'build' ? './' : '/',
    plugins: [
      react(),
      viteMockServe({
        mockPath: 'mocks',
        enable: enableMock,
        watchFiles: true,
        logger: true,
      }),
    ],
    test: {
      globals: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      environment: 'node',
    },
    server: {
      port: 5173,
      proxy: enableMock
        ? undefined
        : {
            '/api': {
              target: backendTarget,
              changeOrigin: true,
            },
            '/s': {
              target: backendTarget,
              changeOrigin: true,
            },
          },
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  };
});
