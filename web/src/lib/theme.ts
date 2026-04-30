// DASS default theme.
export const THEME: string = 'dass';

export const getThemeClass = () => {
  switch (THEME) {
    case 'dass':
    case 'dassTheme':
      return 'theme-dass';
    case 'bssTheme':
      return 'theme-bss';
    case 'default':
    default:
      return 'theme-default';
  }
};
