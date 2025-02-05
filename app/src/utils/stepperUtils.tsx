import {theme} from '../gui/themes';
import {generateStepperColors} from './generateStepperColors';

/**
 * Fetches stepper colors based on the theme configuration.
 * It dynamically determines the stepper color set using the theme's primary color.
 *
 * @param {number} totalSteps - The total number of steps in the stepper.
 * @returns {string[]} An array of stepper colors for each step.
 */
export const getStepperColors = (totalSteps: number) => {
  return generateStepperColors(
    totalSteps,
    theme.palette.primary.main === '#000000' ? 'bss' : 'default'
  );
};
