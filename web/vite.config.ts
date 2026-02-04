import path from 'path';
import react from '@vitejs/plugin-react-swc';
import {defineConfig} from 'vite';
import {tanstackRouter} from '@tanstack/router-plugin/vite';

export default defineConfig({
  // Just a hack to get this to typecheck - works fine??
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3001,
    host: true,
    fs: {allow: ['..']},
  },
  optimizeDeps: {
    include: [],
    exclude: [],
  },
  // Polyfill global in case of weird importing going on!
  define: {
    global: 'globalThis',
  },
});
