// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: actions.ts
 * Description:
 *   Jest mock stub for the barcode scanner.
 */

import {vi} from 'vitest';

vi.mock('@capacitor-community/barcode-scanner', () => {
  return {
    hideBackground: vi.fn(() => {}),
    startScan: vi.fn(() => {}),
    showBackground: vi.fn(() => {}),
    checkPermission: vi.fn(() => {}),
    openAppSettings: vi.fn(() => {}),
  };
});

export {};
