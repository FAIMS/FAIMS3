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
import React, {ReactNode, useRef, useState} from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fade,
  IconButton,
  Popover,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {theme} from '../themes';
import {RichTextField} from './RichText';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CloseIcon from '@mui/icons-material/Close';

/**
 * @interface FieldWrapperProps
 * @description Defines the props for the `FieldWrapper` component.
 *
 * @property {ReactNode} [heading] - The main label or heading for the input field.
 * @property {ReactNode} [subheading] - The help text or description for additional guidance.
 * @property {ReactNode} children - The actual input field component wrapped inside.
 * @property {ReactNode} required - To visually show that it's a required field if it is.
 * @property {string} [advancedHelperText] - Optional markdown-based advanced help text shown in dialog.
 */
interface FieldWrapperProps {
  heading?: ReactNode;
  subheading?: ReactNode;
  children: ReactNode;
  required?: boolean;
  advancedHelperText?: string;
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
  const handleOpen = () => setOpenDialog(true);

  const handleClose = () => {
    setAnchorEl(null);
  };
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const iconRef = useRef(null);
  const muiTheme = useTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('sm'));

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
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

          {/* More info help tooltip  */}
          {advancedHelperText && (
            <IconButton
              aria-label="Advanced Help"
              size="medium"
              onClick={() => setOpenDialog(true)}
              sx={{
                mt: '6px',
                height: 32,
                width: 32,
                padding: 0.5,
                color: '#fff',
                backgroundColor: theme.palette.info.main,
                '&:hover': {
                  backgroundColor: theme.palette.info.dark,
                  color: '#fff',
                },
                borderRadius: '50%',
              }}
            >
              <InfoOutlinedIcon
                sx={{
                  fontSize: '1.6rem',
                  fontWeight: 700,
                  stroke: '#FFFFFFFF',
                  strokeWidth: 0.9,
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
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.draftBackground,
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
            color: theme.palette.text.primary,
          }}
        >
          Field: {typeof heading === 'string' ? heading : 'This field'}
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
              color: theme.palette.text.primary,
            }}
          >
            <RichTextField content={advancedHelperText ?? ''} />
          </Box>
        </DialogContent>

        <DialogActions sx={{pt: 2, justifyContent: 'flex-end'}}>
          <Button
            onClick={() => setOpenDialog(false)}
            variant="contained"
            sx={{
              backgroundColor: theme.palette.background.draftBackground,
              color: theme.palette.dialogButton.confirm,
              fontWeight: 'bold',
              textTransform: 'none',
              fontSize: isMobile ? '0.85rem' : '0.95rem',
              px: 2.5,
              '&:hover': {
                backgroundColor: theme.palette.text.primary,
                color: '#fff',
              },
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FieldWrapper;
