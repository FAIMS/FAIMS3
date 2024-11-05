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
 * Filename: loadingApp.tsx
 * Description:
 *   TODO
 */

import {CircularProgress} from '@mui/material';
import SystemAlert from './alert';

export default function LoadingApp() {
  return (
    <div
      style={{
        margin: 'auto',
        padding: '32px',
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        maxWidth: '256px',
        height: '100%',
        textAlign: 'center',
        gap: '32px',
      }}
    >
      <img src="/assets/icons/icon-512.webp" style={{maxWidth: '100%'}} />
      <div>Loading data</div>
      <CircularProgress color={'primary'} thickness={5} />
      <div>
        This may take some time on first load, depending on your connection
        speed.
      </div>
      <SystemAlert />
    </div>
  );
}
