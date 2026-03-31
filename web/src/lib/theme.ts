export const THEME = import.meta.env.VITE_THEME || 'default';

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
