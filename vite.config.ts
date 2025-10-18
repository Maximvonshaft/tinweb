import { defineConfig, type PluginOption } from 'vite';
import react from '@vitejs/plugin-react';
import { viteMockServe } from 'vite-plugin-mock';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mockDatasetFile = resolve(__dirname, 'federated-drive-mock-dataset.json');

const watchMockDatasetPlugin: PluginOption = {
  name: 'watch-mock-dataset',
  configureServer(server) {
    server.watcher.add(mockDatasetFile);
  },
  buildStart() {
    this.addWatchFile(mockDatasetFile);
  },
};

export default defineConfig(({ command }) => {
  const enableMock = process.env.ENABLE_MOCK === '1' || command === 'serve';

  return {
    plugins: [
      react(),
      viteMockServe({
        mockPath: 'mocks',
        localEnabled: enableMock,
        prodEnabled: false,
        watchFiles: true,
        logger: true,
      }),
      watchMockDatasetPlugin,
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
