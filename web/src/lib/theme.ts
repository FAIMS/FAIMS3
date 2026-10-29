// SPDX-License-Identifier: Apache-2.0
import {config} from '@/constants';

/**
 * Web theme selector aligned with app theme names.
 *
 * Sourced from the shared config (`VITE_THEME`), which defaults to `default`.
 */
export const THEME: string = config.theme || 'default';

export const getThemeClass = (theme: string = THEME) => {
  switch (theme) {
    case 'bssTheme':
      return 'theme-bss';
    case 'fieldmark':
      // Web's default CSS token set is the Fieldmark-style green palette.
      return 'theme-default';
    case 'default':
    default:
      return 'theme-default';
  }
};
