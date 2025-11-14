import {defineConfig} from 'vite';
import {resolve} from 'path';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig(({command}) => {
  if (command === 'serve') {
    // Dev server configuration - serves src/index.tsx as test app
    return {
      plugins: [react({jsxImportSource: '@emotion/react'})],
      root: '.',
    };
  } else {
    // Build configuration - builds lib/index.tsx as library
    return {
      plugins: [react({jsxImportSource: '@emotion/react'})],
      build: {
        emptyOutDir: false, // don't remove tsc artifacts
        lib: {
          entry: resolve(__dirname, 'lib/index.tsx'),
          formats: ['es'],
          fileName: 'index',
        },
        rollupOptions: {
          external: [
            'react',
            'react-dom',
            'react/jsx-runtime',
            '@emotion/react',
            '@emotion/styled',
            '@mui/material',
            '@mui/icons-material',
            '@tanstack/react-form',
            '@faims3/data-model',
            'dompurify',
            'markdown-it',
            'zod',
          ],
        },
      },
    };
  }
});
