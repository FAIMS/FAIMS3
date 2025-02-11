import {theme} from '../gui/themes';
import {generateStepperColors} from './generateStepperColors';

/**
 * Fetches stepper colors dynamically based on the theme.
 */
export const getStepperColors = (totalSteps: number) => {
  const themeType =
    theme.palette.primary.main === '#000000' ? 'bss' : 'default';
  console.log('theeemstype in stepper utils', themeType);

  return generateStepperColors(totalSteps, themeType);
};
