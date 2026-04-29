// FAIMS default theme.
export const THEME: string = 'default';

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
