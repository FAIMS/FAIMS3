export const THEME = import.meta.env.VITE_THEME || 'default';

export const getThemeClass = () => {
  switch (THEME) {
    case 'bssTheme':
      return 'theme-bss';
    case 'default':
    default:
      return 'theme-default';
  }
};
