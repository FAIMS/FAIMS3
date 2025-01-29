/**
 * @file FieldWrapper.tsx
 * @description A reusable wrapper component for form fields.
 *
 * This component provides a consistent structure for form fields, ensuring:
 * - A bold heading for field labels.
 * - A subheading for help text or descriptions.
 * - A proper layout with spacing.
 *
 * It is used across multiple input components to standardize the UI.
 */
import React, {ReactNode} from 'react';
import {Box, Typography} from '@mui/material';
import {theme} from '../themes';

/**
 * @interface FieldWrapperProps
 * @description Defines the props for the `FieldWrapper` component.
 *
 * @property {ReactNode} [heading] - The main label or heading for the input field.
 * @property {ReactNode} [subheading] - The help text or description for additional guidance.
 * @property {ReactNode} children - The actual input field component wrapped inside.
 * @property {ReactNode} required - To visually show that it's a required field if it is.
 */
interface FieldWrapperProps {
  heading?: ReactNode;
  subheading?: ReactNode;
  children: ReactNode;
  required?: boolean;
}

/**
 * @component FieldWrapper
 * @description A higher-order component that standardizes the display of form fields.
 *
 * - **Heading:** Renders the field label as a bold title (`Typography variant="h6"`).
 * - **Subheading:** Renders help text in a smaller, muted format (`Typography variant="caption"`).
 * - **Children:** Wraps the actual form input component.
 *
 * @param {FieldWrapperProps} props - Props containing heading, subheading, and children.
 * @returns {JSX.Element} A styled container for form fields.
 */
const FieldWrapper: React.FC<FieldWrapperProps> = ({
  heading,
  subheading,
  children,
  required,
}) => {
  return (
    <Box sx={{marginBottom: 3}}>
      {/* Heading (Label) */}
      {!!heading && (
        <Typography
          variant="h5"
          sx={{
            fontWeight: 'bold',
            marginBottom: 0.75,
            fontSize: {xs: '1.1rem', md: '1.25rem'},
          }}
        >
          {heading}{' '}
          {required && (
            <span
              style={{
                color: theme.palette.alert.warningText,
                marginLeft: 2,
                fontSize: '1.4em',
                fontWeight: 'bold',
              }}
            >
              *
            </span>
          )}
        </Typography>
      )}

      {/* Subheading (Help Text) */}
      {subheading && (
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.helpText,
            marginBottom: 1,
            fontSize: {xs: '0.9rem', md: '1rem'},
          }}
        >
          {subheading}
        </Typography>
      )}

      {/* Input Field */}
      <Box>{children}</Box>
    </Box>
  );
};

export default FieldWrapper;
