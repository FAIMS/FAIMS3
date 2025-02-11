type ThemeType = 'bss' | 'default';

// Designated colors based on step status
const stepColors = {
  bss: {
    current: '#000000', // Black
    visited: '#228B22', // Forest Green
    error: '#B22222', // Firebrick Red
    notVisited: '#BDBDBD', // Light Gray
  },
  default: {
    current: '#1A1A1A', // Dark Black
    visited: '#4CAF50', // Green
    error: '#FF0000', // Bright Red
    notVisited: '#CCCCCC', // Light Gray
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
