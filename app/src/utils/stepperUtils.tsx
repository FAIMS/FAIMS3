import {theme} from '../gui/themes';
import {generateStepperColors} from './generateStepperColors';

/**
 * Fetches stepper colors dynamically based on the theme.
 */
export const getStepperColors = (totalSteps: number) => {
  const themeType = theme.themeType as keyof typeof theme.palette.stepper; // Get from theme
  console.log('Theme Type in stepper utils:', themeType);

  return generateStepperColors(totalSteps);
};
