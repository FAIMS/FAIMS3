export type ThemeType = 'bss' | 'default';

// Designated colors based on step status
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
    notVisited: '#CFF292A0',
  },
};

/**
 * Generates an array of default stepper colors (all steps default to 'notVisited').
 */
export const generateStepperColors = (
  steps: number,
  themeType: ThemeType = 'default'
): string[] => {
  return new Array(steps).fill(stepColors[themeType].notVisited);
};

/**
 * Determines the color of a step based on its status.
 * @param {string} sectionId - The unique section identifier.
 * @param {string} currentStepId - The currently active step's section ID.
 * @param {boolean} hasError - If the step has errors.
 * @param {string[]} visitedSteps - Array of visited step section IDs.
 * @param {ThemeType} themeType - Theme type ('bss' or 'default').
 * @returns {string} The color for the step.
 */
export const getStepColor = (
  sectionId: string,
  currentStepId: string,
  hasError: boolean,
  visitedSteps: string[],
  themeType: ThemeType
): string => {
  const colors = stepColors[themeType];

  if (sectionId === currentStepId) return colors.current;
  if (hasError) return colors.error;
  if (visitedSteps.includes(sectionId)) return colors.visited;
  return colors.notVisited;
};
