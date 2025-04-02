import path from 'path';
import react from '@vitejs/plugin-react';
import {defineConfig} from 'vite';
import {TanStackRouterVite} from '@tanstack/router-plugin/vite';

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
