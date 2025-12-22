import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {Box, Button, CircularProgress} from '@mui/material';
import {ReactNode} from 'react';

export interface NavigationButtonsConfig {
  /** Primary text displayed on the button */
  label: string;
  /** Optional secondary text displayed below the label */
  subtitle?: string;
  /** Click handler for the button */
  onClick: () => void;
  /** Whether this button is currently disabled */
  disabled?: boolean;
  /** Whether to show a loading spinner instead of the back arrow */
  loading?: boolean;
  /** Optional status text (e.g., "saving...") shown after the label */
  statusText?: string;
  /** Custom icon to use instead of the default back arrow */
  icon?: ReactNode;
}

export interface NavigationButtonsTemplateProps {
  /** Array of button configurations to render */
  buttons: NavigationButtonsConfig[];
  /** Gap between buttons (MUI spacing units) */
  gap?: number;
  /** Bottom margin (MUI spacing units) */
  marginBottom?: number;
}

/**
 * Renders a vertical stack of navigation buttons with consistent styling.
 * Each button displays a back arrow (or custom icon), primary label,
 * optional subtitle, and optional status indicator.
 */
export const NavigationButtonsTemplate = ({
  buttons,
  gap = 1,
  marginBottom = 2,
}: NavigationButtonsTemplateProps) => {
  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap, mb: marginBottom}}>
      {buttons.map((button, index) => (
        <NavigationButton key={index} {...button} />
      ))}
    </Box>
  );
};

/**
 * Individual navigation button with icon, label, optional subtitle and status.
 */
const NavigationButton = ({
  label,
  subtitle,
  onClick,
  disabled = false,
  loading = false,
  statusText,
  icon,
}: NavigationButtonsConfig) => {
  const showIcon = icon ?? <ArrowBackIcon fontSize="small" />;

  return (
    <Button
      variant="outlined"
      disabled={disabled || loading}
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: 1,
        textTransform: 'none',
        width: '100%',
      }}
    >
      <Box sx={{display: 'flex', alignItems: 'center', flexShrink: 0}}>
        {loading ? <CircularProgress size={20} /> : showIcon}
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <Box
          component="span"
          sx={{
            whiteSpace: 'wrap',
            textAlign: 'left',
            width: '100%',
            fontSize: subtitle ? '0.875rem' : undefined,
          }}
        >
          {label}
          {statusText && (
            <Box
              component="span"
              sx={{
                ml: 1,
                fontSize: '0.75rem',
                color: 'warning.main',
              }}
            >
              ({statusText})
            </Box>
          )}
        </Box>
        {subtitle && (
          <Box
            component="span"
            sx={{
              whiteSpace: 'wrap',
              width: '100%',
              textAlign: 'left',
              fontSize: '0.75rem',
              color: 'text.secondary',
            }}
          >
            {subtitle}
          </Box>
        )}
      </Box>
    </Button>
  );
};

export default NavigationButtonsTemplate;
