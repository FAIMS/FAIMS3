/**
 * @file FieldWrapper.tsx
 * @description A reusable wrapper component for form fields.
 *
 * This component provides a consistent structure for form fields, ensuring:
 * - A bold heading for field labels.
 * - A subheading for help text or descriptions.
 * - A proper layout with spacing.
 * - A subtle glowing red border when validation errors are present.
 *
 * It is used across multiple input components to standardize the UI.
 */
import CloseIcon from '@mui/icons-material/Close';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
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
import React, {ReactNode, useState} from 'react';
import {PhotoLightbox} from '../../../components/PhotoLightbox';
import {RichTextContent} from '../../../components/RichText';

/**
 * @interface FieldWrapperProps
 * @description Defines the props for the `FieldWrapper` component.
 *
 * @property {ReactNode} [heading] - The main label or heading for the input field.
 * @property {ReactNode} [subheading] - The help text or description for additional guidance.
 * @property {ReactNode} children - The actual input field component wrapped inside.
 * @property {ReactNode} required - To visually show that it's a required field if it is.
 * @property {ReactNode} advancedHelperText - Extended help content shown in a dialog.
 * @property {string[]} errors - Array of error messages to display.
 */
interface FieldWrapperProps {
  heading?: ReactNode;
  subheading?: ReactNode;
  children: ReactNode;
  required?: boolean;
  advancedHelperText?: ReactNode;
  errors?: string[];
}

/**
 * @component FieldWrapper
 * @description A higher-order component that standardizes the display of form fields.
 *
 * - **Heading:** Renders the field label as a bold title (`Typography variant="h6"`).
 * - **Subheading:** Renders help text in a smaller, muted format (`Typography variant="caption"`).
 * - **Children:** Wraps the actual form input component.
 * - **Error State:** Shows a subtle glowing red border when errors are present.
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
  errors = [],
}) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [anchorEl] = useState<null | HTMLElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const open = Boolean(anchorEl);
  // Image clicked inside the advanced helper dialog — opens PhotoLightbox.
  const [zoomImageUrl, setZoomImageUrl] = useState<string | null>(null);
  const onHelperImageClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName === 'IMG') {
      e.preventDefault();
      setZoomImageUrl((target as HTMLImageElement).src);
    }
  };

  const hasErrors = errors.length > 0;

  // This is required at the moment as the onMount validation causes duplicated
  // error strings - but we want onMount validation at least for existing
  // records
  const uniqueErrors = Array.from(new Set(errors));

  return (
    <Box
      sx={{
        marginBottom: 3,
        position: 'relative',
        padding: hasErrors ? 0.9 : 0,
        borderRadius: 2,
        borderWidth: hasErrors ? 1 : 0,
        borderStyle: 'solid',
        borderColor: 'error.main',
        background: 'transparent',
        transition: 'all 0.3s ease-in-out',
      }}
    >
      {/* Heading (Label) + Info Icon for advanced help */}
      {(!!heading || advancedHelperText) && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            mb: 0.75,
            flexWrap: 'wrap',
            gap: 1,
          }}
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
                data-testid="required-indicator"
                style={{
                  color: theme.palette.error.main,
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
                data-testid="advanced-help"
                size="small"
                onClick={() => setOpenDialog(true)}
                sx={{
                  mt: '4px',
                  padding: 0,
                  '&:hover': {
                    backgroundColor: 'transparent',
                  },
                }}
              >
                <InfoOutlinedIcon
                  sx={{
                    fontSize: '1.6rem',
                    strokeWidth: 0.8,
                    color: theme.palette.secondary.main,
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
            marginBottom: 1,
            fontSize: {xs: '0.9rem', md: '1rem'},
            color: 'text.secondary',
          }}
        >
          {subheading}
        </Typography>
      )}

      {/* Input Field */}
      <Box sx={{p: 0.45}}>{children}</Box>

      {/* Error Messages */}
      {hasErrors && (
        <Box
          sx={{
            mt: 0.8,
            p: 1.5,
            backgroundColor: 'rgba(211, 47, 47, 0.08)',
            borderLeftWidth: 4,
            borderLeftStyle: 'solid',
            borderLeftColor: 'error.main',
            borderRadius: 1,
          }}
        >
          {uniqueErrors.map((error, index) => (
            <Box
              key={index}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                mb: index < uniqueErrors.length - 1 ? 1 : 0,
              }}
            >
              <ErrorOutlineIcon
                sx={{
                  color: 'error.main',
                  fontSize: '1.3rem',
                  mt: '1px',
                }}
              />
              <Typography
                sx={{
                  color: 'error.dark',
                  fontSize: {xs: '0.95rem', md: '1rem'},
                  fontWeight: 600,
                }}
              >
                {error}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Advanced Helper Dialog Backdrop */}
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
            zIndex: 1200,
          }}
        />
      )}

      {/* Centered Dialog */}
      {typeof advancedHelperText === 'string' && advancedHelperText.trim() && (
        <Dialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          fullWidth
          maxWidth="sm"
          slotProps={{
            paper: {
              sx: {
                borderRadius: 2,
                m: {xs: 1.5, sm: 4},
                width: {xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)'},
                maxHeight: {xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)'},
                boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
              },
            },
          }}
        >
          <DialogTitle
            sx={{
              fontWeight: 'bold',
              fontSize: {xs: '1.1rem', sm: '1.2rem'},
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              py: {xs: 1.25, sm: 1.75},
              px: {xs: 1.75, sm: 2.5},
            }}
          >
            <Box
              component="span"
              sx={{flex: 1, minWidth: 0, wordBreak: 'break-word'}}
            >
              {heading}
            </Box>
            <IconButton
              onClick={() => setOpenDialog(false)}
              size="small"
              aria-label="Close"
              sx={{flexShrink: 0, mt: -0.5, mr: -0.5}}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent
            dividers
            onClick={onHelperImageClick}
            sx={{
              px: {xs: 1.75, sm: 2.5},
              py: {xs: 1.25, sm: 1.75},
              overflowY: 'auto',
              '& img': {
                maxWidth: '100%',
                marginTop: 1,
                borderRadius: 1,
                display: 'block',
                boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                cursor: 'zoom-in',
              },
              '& p': {
                wordBreak: 'break-word',
              },
            }}
          >
            <Box
              sx={{
                fontSize: {xs: '0.95rem', sm: '1rem'},
                lineHeight: 1.6,
              }}
            >
              <RichTextContent content={String(advancedHelperText || '')} />
            </Box>
          </DialogContent>

          <DialogActions
            sx={{
              px: {xs: 1.75, sm: 2.5},
              py: {xs: 1, sm: 1.25},
              justifyContent: 'flex-end',
            }}
          >
            <Button
              onClick={() => setOpenDialog(false)}
              variant="contained"
              sx={{
                fontWeight: 'bold',
                textTransform: 'none',
                fontSize: isMobile ? '0.85rem' : '0.95rem',
                px: 2.5,
                '&:hover': {
                  color: '#fff',
                },
              }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Click-to-zoom lightbox for images inside the helper dialog. */}
      {zoomImageUrl && (
        <PhotoLightbox
          url={zoomImageUrl}
          onClose={() => setZoomImageUrl(null)}
        />
      )}
    </Box>
  );
};

export default FieldWrapper;
