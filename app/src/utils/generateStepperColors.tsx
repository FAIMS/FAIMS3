import {theme} from '../gui/themes';

/**
 * Generates an array of default stepper colors (all steps default to 'notVisited').
 */
export const generateStepperColors = (steps: number): string[] => {
  return new Array(steps).fill(theme.stepperColors.notVisited);
};

/**
 * Determines the color of a step based on its status.
 * @param {string} sectionId - The unique section identifier.
 * @param {string} currentStepId - The currently active step's section ID.
 * @param {boolean} hasError - If the step has errors.
 * @param {Set<string>} visitedSteps - Set of visited step section IDs.
 * @returns {string} The color for the step.
 */
export const getStepColor = (
  sectionId: string,
  currentStepId: string,
  hasError: boolean,
  visitedSteps: Set<string>,
): string => {
  const colors = theme.stepperColors;
  if (sectionId === currentStepId) return colors.current; // Current step color

  if (hasError && visitedSteps.has(sectionId)) return colors.error; // Mark as error

  if (visitedSteps.has(sectionId)) return colors.visited;

  return colors.notVisited;
};
