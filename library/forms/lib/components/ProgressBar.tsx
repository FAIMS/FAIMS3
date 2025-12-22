import {useTheme} from '@mui/material/styles';
import {CompletionResult} from '../formModule/types';

interface BaseProgressBarProps {
  style?: React.CSSProperties;
  barStyle?: React.CSSProperties;
}

interface ProgressBarProps extends BaseProgressBarProps {
  completion: number;
}

interface FormProgressBarProps extends BaseProgressBarProps {
  completion: CompletionResult;
}

/**
 * Internal component that renders the actual progress bar visual.
 */
function ProgressBarBase({
  percentage,
  subtitle,
  style,
  barStyle,
}: BaseProgressBarProps & {percentage: number; subtitle: string}) {
  const theme = useTheme();
  const rounded = Math.round(percentage * 100);

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
      <div style={{fontSize: '12px'}}>{subtitle}</div>
    </div>
  );
}

/**
 * Simple progress bar that displays a percentage completion.
 *
 * @param {ProgressBarProps} props - The properties for the component.
 * @param {number} props.completion - A value between 0 and 1 representing the completion percentage.
 * @param {React.CSSProperties} [props.style] - Additional styles for the container.
 * @param {React.CSSProperties} [props.barStyle] - Additional styles for the progress bar.
 */
export function ProgressBar({completion, style, barStyle}: ProgressBarProps) {
  const rounded = Math.round(completion * 100);
  return (
    <ProgressBarBase
      percentage={completion}
      subtitle={`${rounded}% complete`}
      style={style}
      barStyle={barStyle}
    />
  );
}

/**
 * Form-specific progress bar that displays completion with field counts.
 *
 * @param {FormProgressBarProps} props - The properties for the component.
 * @param {CompletionResult} props.completion - The completion result containing progress and field counts.
 * @param {React.CSSProperties} [props.style] - Additional styles for the container.
 * @param {React.CSSProperties} [props.barStyle] - Additional styles for the progress bar.
 */
export function FormProgressBar({
  completion,
  style,
  barStyle,
}: FormProgressBarProps) {
  const rounded = Math.round(completion.progress * 100);
  return (
    <ProgressBarBase
      percentage={completion.progress}
      subtitle={`Completed ${rounded}% (${completion.completedCount}/${completion.requiredCount} required fields)`}
      style={style}
      barStyle={barStyle}
    />
  );
}
