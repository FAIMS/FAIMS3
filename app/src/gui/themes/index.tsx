import defaultTheme from './default';
import bubbleTheme from './bubble';
import defaultAppBarStyling from './default/appBar';
import bubbleAppBarStyling from './bubble/appBar';
import defaultSurveyListLayout from './default/noteBook';
import bubbleSurveyListLayout from './bubble/noteBook';

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
 * Exports the survey list layout based on the environment variable VITE_THEME.
 *
 * @returns {object} The survey list layout object. Returns `bubbleSurveyListLayout` if VITE_THEME is 'bubble', otherwise returns `defaultSurveyListLayout`.
 */
const exportSurveyListLayout = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bubble':
      return bubbleSurveyListLayout;
    default:
      return defaultSurveyListLayout;
  }
};

/**
 * Exports whether the survey list should be verbose based on the environment variable VITE_THEME.
 *
 * @returns {boolean} `false` if VITE_THEME is 'bubble', otherwise `true`.
 */
const exportSurveyListVerbose = () => {
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

export const theme = exportTheme();
export const appBarStyling = exportAppBarStyling();
export const surveyListLayout = exportSurveyListLayout();
export const surveyListVerbose = exportSurveyListVerbose();
export const appBarHeading = exportAppBarHeading();
