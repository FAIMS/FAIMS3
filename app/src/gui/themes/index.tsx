import defaultTheme from './default';
import bubbleTheme from './bubble';
import defaultAppBarStyling from './default/appBar';
import bubbleAppBarStyling from './bubble/appBar';
import defaultProjectListLayout from './default/noteBook';
import bubbleProjectListLayout from './bubble/noteBook';

/**
 * Exports the theme based on the environment variable VITE_THEME.
 *
 * @returns {object} The theme object. Returns `bubbleTheme` if VITE_THEME is 'bubble', otherwise returns `defaultTheme`.
 */
const exportTheme = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bubble':
      return bubbleTheme;
    default:
      return defaultTheme;
  }
};

/**
 * Exports the AppBar styling based on the environment variable VITE_THEME.
 *
 * @returns {object} The AppBar styling object. Returns `bubbleAppBarStyling` if VITE_THEME is 'bubble', otherwise returns `defaultAppBarStyling`.
 */
const exportAppBarStyling = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bubble':
      return bubbleAppBarStyling;
    default:
      return defaultAppBarStyling;
  }
};

/**
 * Exports the project list layout based on the environment variable VITE_THEME.
 *
 * @returns {object} The project list layout object. Returns `bubbleProjectListLayout` if VITE_THEME is 'bubble', otherwise returns `defaultProjectListLayout`.
 */
const exportProjectListLayout = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bubble':
      return bubbleProjectListLayout;
    default:
      return defaultProjectListLayout;
  }
};

/**
 * Exports whether the project list should be verbose based on the environment variable VITE_THEME.
 *
 * @returns {boolean} `false` if VITE_THEME is 'bubble', otherwise `true`.
 */
const exportProjectListVerbose = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bubble':
      return false;
    default:
      return true;
  }
};

/**
 * Exports the AppBar heading based on the environment variable VITE_THEME.
 *
 * @returns {string} The AppBar heading. Returns 'bubble' if VITE_THEME is 'bubble', otherwise returns 'default'.
 */
const exportAppBarHeading = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bubble':
      return 'bubble';
    default:
      return 'default';
  }
};

/**
 * Exports custom styling for the tabs based on the current theme.
 *
 * This function provides specific styles for the "bubble" theme, including background color, border,
 * tab text styling, hover effects, and tab indicator customization. For other themes, it returns
 * an empty style object.
 *
 * @returns {object} The styling object for the tabs:
 *  - `tabsRoot`: Styles for the root of the `Tabs` component, including background color and border.
 *  - `tabRoot`: Styles for each individual `Tab` component, including font size, font weight, color, and hover effects.
 *  - `indicator`: Styles for the tab indicator, including color and thickness.
 */
const exportBSSTabStyling = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bubble':
      return {
        tabsRoot: {
          backgroundColor: '#f5f5f5',
          borderBottom: '1px solid grey',
        },
        tabRoot: {
          fontWeight: 600,
          fontSize: '1rem',
          textTransform: 'none',
          minWidth: 100,
          color: '#000000',
          '&.Mui-selected': {
            color: 'white',
            backgroundColor: '#050606e8',
          },
          '&:hover': {
            backgroundColor: 'black',
          },
        },
        indicator: {
          backgroundColor: 'white',
          height: 4,
        },
      };
    default:
      return {};
  }
};

export const theme = exportTheme();
export const appBarStyling = exportAppBarStyling();
export const projectListLayout = exportProjectListLayout();
export const projectListVerbose = exportProjectListVerbose();
export const appBarHeading = exportAppBarHeading();
export const bssTabStyling = exportBSSTabStyling();
