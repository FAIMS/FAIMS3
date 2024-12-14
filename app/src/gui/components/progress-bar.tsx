import {useTheme} from '@mui/material/styles';

interface ProgressBarProps {
  percentage: number;
  style?: React.CSSProperties;
}

/**
 * ProgressBar component that visually represents the progress based on the percentage prop.
 *
 * @param {ProgressBarProps} props - The properties for the component.
 * @param {number} props.percentage - A value between 0 and 1 representing the completion percentage.
 * @param {React.CSSProperties} props.style - Additional styles for the progress bar.
 * @returns {JSX.Element} A visual representation of the progress in the form of a bar and percentage text.
 */
export default function ProgressBar({percentage, style}: ProgressBarProps) {
  const rounded = Math.round(percentage * 100);
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
          backgroundColor: theme.palette.progressBar.background,
          borderRadius: '6px',
        }}
      >
        <div
          style={{
            width: `${rounded}%`,
            height: '32px',
            backgroundColor: theme.palette.progressBar.complete,
            borderRadius: '6px',
          }}
        ></div>
      </div>
      <div style={{fontSize: '12px'}}>{rounded}% Completed</div>
    </div>
  );
}
