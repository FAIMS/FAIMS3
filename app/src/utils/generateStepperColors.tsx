type ThemeType = 'bss' | 'default';

// color gradients for each theme
const colorPalettes = {
  bss: [
    '#6B5959FF',
    '#B22222',
    '#FF4500',
    '#FF8C00',
    '#FFD700',
    '#A0522D',
    '#6B8E23',
    '#228B22',
    '#2F4F4F',
  ],
  default: [
    '#A7E938',
    '#77C727',
    '#4DAF0A',
    '#3B8E0D',
    '#50790D',
    '#DA9449',
    '#E18200',
    '#828789',
    '#4B4B4B',
  ],
};

/**
 * Generates a gradient color array for the stepper component based on the number of steps
 * and the selected theme type.
 *
 * @function generateStepperColors
 * @param {number} steps - The total number of steps in the stepper.
 * @param {ThemeType} [themeType='default'] - The theme type used to determine the color palette.
 *                                            Defaults to 'default' and 'bss' for bss theme.
 * @returns {string[]} An array of color codes representing the gradient for each step.
 *                     The final step always uses a specific color based on the theme type.
 */
export const generateStepperColors = (
  steps: number,
  themeType: ThemeType = 'default'
): string[] => {
  const gradientColors = colorPalettes[themeType];
  const finalStepColor = themeType === 'bss' ? '#339436FF' : '#324C08';

  if (steps <= 1) return [finalStepColor];

  const gradient = [];
  for (let i = 0; i < steps - 1; i++) {
    const colorIndex = Math.floor(
      (i / (steps - 2)) * (gradientColors.length - 1)
    );
    gradient.push(gradientColors[colorIndex]);
  }

  gradient.push(finalStepColor);
  return gradient;
};
