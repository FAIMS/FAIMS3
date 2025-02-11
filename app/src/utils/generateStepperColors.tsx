export type ThemeType = 'bss' | 'default';

// Designated colors based on step status
const stepColors = {
  bss: {
    current: '#000000',
    visited: '#0CD80CFF',
    error: '#E81414FF',
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
 */
export const getStepColor = (
  index: number,
  currentStep: number,
  hasError: boolean,
  visitedSteps: number[],
  themeType: ThemeType
): string => {
  const colors = stepColors[themeType];

  if (index === currentStep) return colors.current;
  if (hasError) return colors.error;
  if (visitedSteps.includes(index)) return colors.visited;
  return colors.notVisited;
};
