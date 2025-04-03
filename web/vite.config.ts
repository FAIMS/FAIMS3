import path from 'path';
import react from '@vitejs/plugin-react';
import {defineConfig, PluginOption} from 'vite';
import {TanStackRouterVite} from '@tanstack/router-plugin/vite';

export default defineConfig({
  // Just a hack to get this to typecheck - works fine??
  plugins: [TanStackRouterVite(), react() as PluginOption],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
