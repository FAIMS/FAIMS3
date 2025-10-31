import {defineConfig} from 'vite';
import {resolve} from 'path';
import react from '@vitejs/plugin-react-swc';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({jsxImportSource: '@emotion/react'})],
  build: {
    lib: {
      entry: resolve(__dirname, 'lib/index.tsx'),
      formats: ['es'],
    },
    rollupOptions: {
      // Externalize deps that shouldn't be bundled
      external: ['react', 'react-dom', 'react/jsx-runtime'],
    },
  },
});
