import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteMockServe } from 'vite-plugin-mock';

export default defineConfig(({ command }) => {
  const enableMock = process.env.ENABLE_MOCK === '1' || command === 'serve';

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
    server: {
      port: 5173,
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  };
});
