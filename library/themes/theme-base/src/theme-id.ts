import {SUPPORTED_THEME_IDS, ThemeId} from './types';

function isThemeId(value: string): value is ThemeId {
  return (SUPPORTED_THEME_IDS as readonly string[]).includes(value);
}

export function resolveThemeId(
  rawTheme: string | undefined,
  options: {strict?: boolean; source?: string} = {}
): ThemeId {
  const strict = options.strict ?? false;
  const source = options.source ?? 'VITE_THEME';

  if (rawTheme === undefined || rawTheme === '') {
    return 'default';
  }

  if (rawTheme === 'bubble') {
    throw new Error(
      `${source}=bubble is no longer supported. Use one of: ${SUPPORTED_THEME_IDS.join(', ')}`
    );
  }

  if (isThemeId(rawTheme)) {
    return rawTheme;
  }

  if (strict) {
    throw new Error(
      `${source}=${rawTheme} is not supported. Use one of: ${SUPPORTED_THEME_IDS.join(', ')}`
    );
  }

  console.warn(
    `Unsupported theme ${rawTheme}; falling back to default. Supported values: ${SUPPORTED_THEME_IDS.join(', ')}`
  );
  return 'default';
}
