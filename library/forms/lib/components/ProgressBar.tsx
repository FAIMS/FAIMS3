import {useTheme} from '@mui/material/styles';
import {CompletionResult} from '../formModule/types';

interface ProgressBarProps {
  completion: CompletionResult;
  style?: React.CSSProperties;
  barStyle?: React.CSSProperties;
}

/**
 * ProgressBar component that visually represents the progress based on the percentage prop.
 *
 * @param {ProgressBarProps} props - The properties for the component.
 * @param {number} props.percentage - A value between 0 and 1 representing the completion percentage.
 * @param {React.CSSProperties} props.style - Additional styles for the progress bar.
 * @returns {JSX.Element} A visual representation of the progress in the form of a bar and percentage text.
 */
export function ProgressBar({completion, style, barStyle}: ProgressBarProps) {
  const rounded = Math.round(completion.progress * 100);
  const theme = useTheme(); // Use the current active theme

  return (
    <div
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div
        style={{
          backgroundColor: '#e0e0e0',
          borderRadius: '10px',
        }}
      >
        <div
          style={{
            width: `${rounded}%`,
            height: '32px',
            backgroundColor: theme.palette.primary.main || 'red',
            borderRadius: '10px',
            ...barStyle,
          }}
        ></div>
      </div>
      <div style={{fontSize: '12px'}}>
        Completed {rounded}% ({completion.completedCount}/
        {completion.requiredCount} required fields)
      </div>
    </div>
  );
}
