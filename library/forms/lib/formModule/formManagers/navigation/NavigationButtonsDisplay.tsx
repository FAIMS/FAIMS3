import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {Box, Button, CircularProgress} from '@mui/material';
import React, {ReactNode} from 'react';
import {NavigationButtonConfig} from './types';

// ============================================================================
// Component Props
// ============================================================================

export interface NavigationButtonsDisplayProps {
  /** Ordered array of button configurations to render */
  buttons: NavigationButtonConfig[];
  /** Gap between buttons (MUI spacing units) */
  gap?: number;
  /** Bottom margin (MUI spacing units) */
  marginBottom?: number;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface SingleButtonProps {
  label: string;
  subtitle?: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  loading?: boolean;
  statusText?: string;
  icon?: ReactNode;
}

/**
 * Individual navigation button with icon, label, optional subtitle and status.
 */
const NavigationButton: React.FC<SingleButtonProps> = ({
  label,
  subtitle,
  onClick,
  disabled = false,
  loading = false,
  statusText,
  icon,
}) => {
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

// ============================================================================
// Main Component
// ============================================================================

/**
 * NavigationButtonsDisplay - Renders navigation buttons in a consistent layout.
 *
 * This is a pure presentation component that takes an array of button
 * configurations and renders them. It has no knowledge of navigation logic
 * or form state - all that is computed by the useNavigationLogic hook.
 *
 * @example
 * ```tsx
 * const { buttons } = useNavigationLogic({ ... });
 *
 * return <NavigationButtonsDisplay buttons={buttons} />;
 * ```
 */
export const NavigationButtonsDisplay: React.FC<
  NavigationButtonsDisplayProps
> = ({buttons, gap = 1, marginBottom = 2}) => {
  // Don't render anything if there are no buttons
  if (buttons.length === 0) {
    return null;
  }

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap, mb: marginBottom}}>
      {buttons.map(buttonConfig => (
        <NavigationButton
          key={buttonConfig.id}
          label={buttonConfig.label}
          subtitle={buttonConfig.subtitle}
          onClick={buttonConfig.onClick}
          disabled={buttonConfig.disabled}
          loading={buttonConfig.loading}
          statusText={buttonConfig.statusText}
          icon={buttonConfig.icon}
        />
      ))}
    </Box>
  );
};
