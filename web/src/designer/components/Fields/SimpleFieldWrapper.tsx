import {Box, Typography} from '@mui/material';
import {alpha} from '@mui/material/styles';

type SimpleFieldWrapperProps = {
  heading: string;
  helperText?: React.ReactNode;
  children: React.ReactNode;
};

/**
 * Compact field layout wrapper: heading, optional helper text, then input/control.
 */
export const SimpleFieldWrapper = ({
  heading,
  helperText,
  children,
}: SimpleFieldWrapperProps) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        width: '100%',
        minWidth: 0,
      }}
    >
      <Typography
        component="h4"
        sx={{
          fontSize: '1rem',
          fontWeight: 800,
          color: 'text.primary',
          lineHeight: 1.25,
          letterSpacing: '0.012em',
        }}
      >
        {heading}
      </Typography>
      {helperText && (
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            lineHeight: 1.35,
            mt: -0.15,
            px: 0.8,
            py: 0.35,
            borderRadius: 0.85,
            background: theme =>
              `linear-gradient(100deg, ${alpha(theme.palette.info.light, 0.14)} 0%, ${alpha(
                theme.palette.info.main,
                0.08
              )} 20%, ${alpha(theme.palette.text.primary, 0.03)} 58%, ${alpha(
                theme.palette.text.primary,
                0.012
              )} 100%)`,
            boxShadow: theme =>
              `0 1px 5px ${alpha(theme.palette.common.black, 0.04)}, inset 0 1px 0 ${alpha(
                theme.palette.common.white,
                0.72
              )}`,
          }}
        >
          {helperText}
        </Typography>
      )}
      <Box
        sx={{
          width: '100%',
          minWidth: 0,
          px: 0.15,
          py: 0.15,
          borderRadius: 0.9,
          background: theme =>
            `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.95)} 0%, ${alpha(
              theme.palette.text.primary,
              0.028
            )} 100%)`,
          boxShadow: 'none',
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
