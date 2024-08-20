import defaultTheme from './default';
import bubbleTheme from './bubble';
import defaultAppBarStyling from './default/appBar';
import bubbleAppBarStyling from './bubble/appBar';
import defaultSurveyListLayout from './default/noteBook';
import bubbleSurveyListLayout from './bubble/noteBook';

const exportTheme = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bubble':
      return bubbleTheme;
    default:
      return defaultTheme;
  }
};

const exportAppBarStyling = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bubble':
      return bubbleAppBarStyling;
    default:
      return defaultAppBarStyling;
  }
};

const exportSurveyListLayout = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bubble':
      return bubbleSurveyListLayout;
    default:
      return defaultSurveyListLayout;
  }
};

const exportSurveyListVerbose = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bubble':
      return false;
    default:
      return true;
  }
};

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
