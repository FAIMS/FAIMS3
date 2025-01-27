import {createContext, useContext, useEffect, useState} from 'react';

type Theme = 'dark' | 'light' | 'system';

const ThemeProviderContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({
  theme: 'system',
  setTheme: () => null,
});

/**
 * ThemeProvider component provides a context for managing the theme state.
 * It allows components to access the current theme and a function to set the theme.
 *
 * @param {ThemeProviderProps} props - The properties object.
 * @param {React.ReactNode} props.children - The child components to be rendered.
 * @param {Theme} props.defaultTheme - The default theme to be used if none is stored in localStorage.
 * @param {string} props.storageKey - The key to use for storing the theme in localStorage.
 * @returns {JSX.Element} The rendered ThemeProvider component.
 */
export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'vite-ui-theme',
  ...props
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
        .matches
        ? 'dark'
        : 'light';

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme);
      setTheme(theme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

/**
 * useTheme hook returns the current theme and a function to set the theme.
 *
 * @returns {ThemeProviderState} The current theme and a function to set the theme.
 */
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};
