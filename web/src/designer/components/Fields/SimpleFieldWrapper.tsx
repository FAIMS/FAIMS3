import {Box, Typography} from '@mui/material';

type SimpleFieldWrapperProps = {
  heading: string;
  helperText?: string;
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
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 0.75}}>
      <Typography
        component="h4"
        sx={{fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.25}}
      >
        {heading}
      </Typography>
      {helperText && (
        <Typography
          variant="body2"
          sx={{color: 'text.secondary', lineHeight: 1.35, mt: -0.25}}
        >
          {helperText}
        </Typography>
      )}
      <Box>{children}</Box>
    </Box>
  );
};
