import {theme} from '../gui/themes';

export type ThemeType = keyof typeof stepColors; // Ensures ThemeType is only 'bss' | 'default'

const stepColors = {
  bss: {
    current: '#000000',
    visited: '#07a907',
    error: '#EE1616FF',
    notVisited: '#BDBDBD',
  },
  default: {
    current: '#E18200',
    visited: '#669911',
    error: '#D50C0CFF',
    notVisited: '#B7C1A6F1',
  },
} as const;

/**
 * Generates an array of default stepper colors (all steps default to 'notVisited').
 */
export const generateStepperColors = (steps: number): string[] => {
  const themeType: ThemeType = theme.themeType as ThemeType; // Get from theme
  return new Array(steps).fill(stepColors[themeType].notVisited);
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
  isRecordSubmitted: boolean
): string => {
  const themeType: ThemeType = theme.themeType as ThemeType; // Get from theme
  const colors = stepColors[themeType];

  if (sectionId === currentStepId) return colors.current; // Current step color

  if (hasError && visitedSteps.has(sectionId) && !isRecordSubmitted) {
    return colors.error; // Mark as error
  }

  if (visitedSteps.has(sectionId) || isRecordSubmitted) return colors.visited;

  return colors.notVisited;
};
