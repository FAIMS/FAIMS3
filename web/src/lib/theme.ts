/**
 * Web theme selector aligned with app theme names.
 *
 * Precedence:
 * 1. `VITE_THEME` (matches mobile app naming)
 * 2. `VITE_APP_THEME` (legacy web naming)
 * 3. `default`
 */
export const THEME: string =
  import.meta.env.VITE_THEME || import.meta.env.VITE_APP_THEME || 'default';

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
