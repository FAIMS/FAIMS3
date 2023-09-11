import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react-swc';

// vite does not shim the global object and we need it for dev but
// not for the production build
const global = process.env.NODE_ENV === 'development' ? 'window' : 'global';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react()],
  define: {
    global: global,
    'process.env': {},
  }
});
