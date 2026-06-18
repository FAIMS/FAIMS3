import type { Theme } from '@mui/material/styles';
import { z } from 'zod';
import bssTheme from '@app-themes/bssTheme';
import defaultTheme from '@app-themes/default';
import fieldmarkTheme from '@app-themes/fieldmark';

const ThemeNameSchema = z.enum(['default', 'bssTheme', 'fieldmark']);

const ThemeEnvSchema = z.object({
  VITE_THEME: ThemeNameSchema.optional().default('default'),
});

const themes: Record<z.infer<typeof ThemeNameSchema>, Theme> = {
  default: defaultTheme,
  bssTheme: bssTheme,
  fieldmark: fieldmarkTheme,
};

/** Resolve the app MUI theme from VITE_THEME (same names as app/web). */
export function getAppTheme(): Theme {
  const env = ThemeEnvSchema.parse({
    VITE_THEME: import.meta.env.VITE_THEME,
  });
  return themes[env.VITE_THEME];
}
