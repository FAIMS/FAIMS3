import faimsTheme from './default';
import fieldmarkTheme from './fieldmark';
import faimsAppBarStyling from './default/appBar';
import fieldmarkAppBarStyling from './fieldmark/appBar';
import faimsProjectListLayout from './default/noteBook';
import fieldmarkProjectListLayout from './fieldmark/noteBook';
import bssTheme from './bssTheme';
export interface StepperColors {
  current: string;
  visited: string;
  error: string;
  notVisited: string;
}

const exportTheme = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bssTheme':
      return bssTheme;
    case 'fieldmark':
      return fieldmarkTheme;
    default:
      return faimsTheme;
  }
};

const exportAppBarStyling = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bssTheme':
      return faimsAppBarStyling;
    case 'fieldmark':
      return fieldmarkAppBarStyling;
    default:
      return faimsAppBarStyling;
  }
};

const exportProjectListLayout = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bssTheme':
      return faimsProjectListLayout;
    case 'fieldmark':
      return fieldmarkProjectListLayout;
    default:
      return faimsProjectListLayout;
  }
};

const exportProjectListVerbose = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bssTheme':
      return true;
    case 'fieldmark':
      return true;
    default:
      return true;
  }
};

const exportAppBarHeading = () => {
  switch (import.meta.env.VITE_THEME) {
    case 'bssTheme':
      return 'bssTheme';
    case 'fieldmark':
      return 'fieldmark';
    default:
      return 'default';
  }
};
export const theme = exportTheme();
export const appBarStyling = exportAppBarStyling();
export const projectListLayout = exportProjectListLayout();
export const projectListVerbose = exportProjectListVerbose();
export const appBarHeading = exportAppBarHeading();
