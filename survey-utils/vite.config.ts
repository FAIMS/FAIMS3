import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const packageDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  root: '.',
  resolve: {
    alias: {
      '@app-themes': path.resolve(packageDir, '../app/src/gui/themes'),
    },
    dedupe: ['@mui/material', '@emotion/react', '@emotion/styled'],
  },
  server: {
    fs: { allow: ['..'] },
  },
  define: {
    global: 'globalThis',
  },
  build: {
    outDir: 'dist',
  },
  optimizeDeps: {
    include: [
      '@mui/material',
      '@mui/material/styles',
      '@emotion/react',
      '@emotion/styled',
      '@emotion/react/jsx-runtime',
    ],
  },
});
