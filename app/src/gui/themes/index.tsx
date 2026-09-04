import faimsTheme from './default';
import fieldmarkTheme from './fieldmark';
import faimsAppBarStyling from './default/appBar';
import fieldmarkAppBarStyling from './fieldmark/appBar';
import faimsProjectListLayout from './default/noteBook';
import fieldmarkProjectListLayout from './fieldmark/noteBook';
import bssTheme from './bssTheme';
import {config} from '../../buildconfig';
export interface StepperColors {
  current: string;
  visited: string;
  error: string;
  notVisited: string;
  mobileBackground: string;
}

const exportTheme = () => {
  switch (config.theme) {
    case 'bssTheme':
      return bssTheme;
    case 'fieldmark':
      return fieldmarkTheme;
    default:
      return faimsTheme;
  }
};

const exportAppBarStyling = () => {
  switch (config.theme) {
    case 'bssTheme':
      return faimsAppBarStyling;
    case 'fieldmark':
      return fieldmarkAppBarStyling;
    default:
      return faimsAppBarStyling;
  }
};

const exportProjectListLayout = () => {
  switch (config.theme) {
    case 'bssTheme':
      return faimsProjectListLayout;
    case 'fieldmark':
      return fieldmarkProjectListLayout;
    default:
      return faimsProjectListLayout;
  }
};

const exportProjectListVerbose = () => {
  switch (config.theme) {
    case 'bssTheme':
      return true;
    case 'fieldmark':
      return true;
    default:
      return true;
  }
};

const exportAppBarHeading = () => {
  switch (config.theme) {
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
