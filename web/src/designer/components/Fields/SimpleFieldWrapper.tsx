import {Box, Typography} from '@mui/material';

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
          fontWeight: 700,
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
          }}
        >
          {helperText}
        </Typography>
      )}
      {children}
    </Box>
  );
};
