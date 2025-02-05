type ThemeType = 'bss' | 'default';

// color gradients for each theme
const colorPalettes = {
  bss: [
    '#FFE5B4',
    '#FFCC80',
    '#FFB74D',
    '#FF8A65',
    '#FF7043',
    '#FF5722',
    '#F4511E',
    '#D84315',
    '#BF360C',
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

export const generateStepperGradient = (
  steps: number,
  themeType: ThemeType = 'default'
): string[] => {
  const gradientColors = colorPalettes[themeType];
  const finalStepColor = themeType === 'bss' ? '#4CAF50' : '#324C08'; //  Ddefault

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
