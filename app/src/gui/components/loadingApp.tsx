// SPDX-License-Identifier: Apache-2.0

/*
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
