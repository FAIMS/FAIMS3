/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: vite.config.ts
 * Description:
 *   Configuration for Vite build
 */

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
    'process.env': {} /* some libraries check this */,
  },
});
