import {resolveThemeId, resolveWebThemeClass} from '@faims3/theme-registry';

/**
 * Web theme selector aligned with app theme names.
 *
 * Precedence:
 * 1. `VITE_THEME` (matches mobile app naming)
 * 2. `VITE_APP_THEME` (legacy web naming)
 * 3. `default`
 */
const rawTheme = import.meta.env.VITE_THEME || import.meta.env.VITE_APP_THEME;

export const THEME = resolveThemeId(rawTheme);

export const getThemeClass = () => resolveWebThemeClass(rawTheme);
