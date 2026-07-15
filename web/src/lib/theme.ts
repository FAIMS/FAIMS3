import {config} from '@/constants';

/**
 * Web theme selector aligned with app theme names.
 *
 * Precedence:
 * 1. `VITE_THEME` (matches mobile app naming; build-time Vite-only)
 * 2. `config.appTheme` from `VITE_APP_THEME` (typed web config)
 * 3. `default`
 */
export const THEME: string =
  import.meta.env.VITE_THEME || config.appTheme || 'default';

export const getThemeClass = () => {
  switch (THEME) {
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
