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
import React, {ReactNode, useState} from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
// import {theme} from '../themes';  TODO how do we apply the theme?
import {RichTextField} from '../fields/RichText';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

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
  advancedHelperText?: ReactNode;
}

/**
 * @component FieldWrapper
 * @description A higher-order component that standardizes the display of form fields.
 *
 * - **Heading:** Renders the field label as a bold title (`Typography variant="h6"`).
 * - **Subheading:** Renders help text in a smaller, muted format (`Typography variant="caption"`).
 * - **Children:** Wraps the actual form input component.
 * If `advancedHelperText` is provided, shows a blue info icon that opens a markdown-supported dialog.
 * @param {FieldWrapperProps} props - Props containing heading, subheading, and children.
 * @returns {JSX.Element} A styled container for form fields.
 */
const FieldWrapper: React.FC<FieldWrapperProps> = ({
  heading,
  subheading,
  children,
  required,
  advancedHelperText,
}) => {
  const [openDialog, setOpenDialog] = useState(false);
  // TODO understand why we have this but never set it other than null? Should
  // this be a ref instead?
  const [anchorEl] = useState<null | HTMLElement>(null);
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));
  const open = Boolean(anchorEl);

  return (
    <Box sx={{marginBottom: 3}}>
      {/* Heading (Label) + Info Icon for advanced help */}
      {(!!heading || advancedHelperText) && (
        <Box
          display="flex"
          alignItems="center"
          mb={0.75}
          flexWrap="wrap"
          gap={1}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 'bold',
              fontSize: {xs: '1.1rem', md: '1.25rem'},
            }}
          >
            {heading}
            {required && (
              <span
                style={{
                  // color: theme.palette.alert.warningText,
                  marginLeft: 2,
                  fontSize: '1.4em',
                  fontWeight: 'bold',
                }}
              >
                *
              </span>
            )}
          </Typography>

          {/* More info help icon with dialog */}
          {typeof advancedHelperText === 'string' &&
            advancedHelperText.trim() && (
              <IconButton
                aria-label="Advanced Help"
                size="small"
                onClick={() => setOpenDialog(true)}
                sx={{
                  mt: '4px',
                  // color: theme.palette.info.main,
                  padding: 0,
                  '&:hover': {
                    backgroundColor: 'transparent',
                  },
                }}
              >
                <InfoOutlinedIcon
                  sx={{
                    fontSize: '1.6rem',
                    // stroke: theme.palette.info.main,
                    strokeWidth: 0.8,
                  }}
                />
              </IconButton>
            )}
        </Box>
      )}

      {/* Subheading (Help Text) */}
      {subheading && (
        <Typography
          variant="body2"
          sx={{
            // color: theme.palette.text.helpText,
            marginBottom: 1,
            fontSize: {xs: '0.9rem', md: '1rem'},
          }}
        >
          {subheading}
        </Typography>
      )}

      {/* Input Field */}
      <Box>{children}</Box>

      {/* Advanced Helper Dialog*/}
      {open && !isMobile && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0,0,0,0.25)',
            backdropFilter: 'blur(3px)',
            WebkitBackdropFilter: 'blur(3px)',
            zIndex: 1200, // Should be less than popover zIndex (1300)
          }}
        />
      )}
      {/* Centered Dialog */}
      {typeof advancedHelperText === 'string' && advancedHelperText.trim() && (
        <Dialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          fullWidth
          maxWidth="md"
          PaperProps={{
            sx: {
              // backgroundColor: theme.palette.background.draftBackground,
              borderRadius: 2,
              p: 2,
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              position: 'relative',
            },
          }}
        >
          <DialogTitle
            sx={{
              fontWeight: 'bold',
              fontSize: '1.2rem',
              paddingRight: 4,
              // color: theme.palette.text.primary,
            }}
          >
            Field: {typeof heading === 'string' ? heading : null}
            <IconButton
              onClick={() => setOpenDialog(false)}
              sx={{position: 'absolute', right: 16, top: 16}}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent
            dividers
            sx={{
              maxHeight: '60vh',
              overflowY: 'auto',
              '& img': {
                maxWidth: '100%',
                height: 'auto',
                marginTop: 1,
                borderRadius: 1,
                display: 'block',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              },
              '& p': {
                wordBreak: 'break-word',
              },
            }}
          >
            <Box
              sx={{
                fontSize: '1rem',
                lineHeight: 1.6,
                // color: theme.palette.text.primary,
              }}
            >
              <RichTextField content={String(advancedHelperText || '')} />
            </Box>
          </DialogContent>

          <DialogActions sx={{pt: 2, justifyContent: 'flex-end'}}>
            <Button
              onClick={() => setOpenDialog(false)}
              variant="contained"
              sx={{
                // backgroundColor: theme.palette.background.draftBackground,
                // color: theme.palette.dialogButton.confirm,
                fontWeight: 'bold',
                textTransform: 'none',
                fontSize: isMobile ? '0.85rem' : '0.95rem',
                px: 2.5,
                '&:hover': {
                  // backgroundColor: theme.palette.text.primary,
                  color: '#fff',
                },
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
};

export default FieldWrapper;
