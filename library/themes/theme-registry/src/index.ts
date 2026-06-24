import {
  ThemeDefinition,
  ThemeId,
  resolveThemeId,
  SUPPORTED_THEME_IDS,
} from '@faims3/theme-base';
import {themeBssDefinition} from '@faims3/theme-bss';
import {themeDefaultDefinition} from '@faims3/theme-default';
import {themeFieldmarkDefinition} from '@faims3/theme-fieldmark';

const THEMES: Record<ThemeId, ThemeDefinition> = {
  default: themeDefaultDefinition,
  fieldmark: themeFieldmarkDefinition,
  bssTheme: themeBssDefinition,
};

export const THEME_PACKAGE_BY_ID: Record<ThemeId, string> = {
  default: '@faims3/theme-default',
  fieldmark: '@faims3/theme-fieldmark',
  bssTheme: '@faims3/theme-bss',
};

export function getThemeDefinition(themeId: ThemeId): ThemeDefinition {
  return THEMES[themeId];
}

export function getThemeDefinitionFromEnv(
  rawTheme: string | undefined,
  options: {strict?: boolean; source?: string} = {}
): ThemeDefinition {
  const themeId = resolveThemeId(rawTheme, options);
  return getThemeDefinition(themeId);
}

export function resolveAppThemeConfig(rawTheme: string | undefined) {
  return getThemeDefinitionFromEnv(rawTheme).app;
}

export function resolveWebThemeConfig(rawTheme: string | undefined) {
  return getThemeDefinitionFromEnv(rawTheme).web;
}

export function resolveWebThemeClass(rawTheme: string | undefined): string {
  return resolveWebThemeConfig(rawTheme).className;
}

export function getThemePackageName(rawTheme: string | undefined): string {
  const themeId = resolveThemeId(rawTheme, {strict: true});
  return THEME_PACKAGE_BY_ID[themeId];
}

export {resolveThemeId, SUPPORTED_THEME_IDS};
export type {
  DesignerThemeTokens,
  ThemeId,
  ThemeDefinition,
  WebThemeConfig,
} from '@faims3/theme-base';
