import {SxProps, Theme} from '@mui/material';
import {alpha} from '@mui/material/styles';

export const designerHeadingRowSx: SxProps<Theme> = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.35,
};

export const designerHeadingTextSx: SxProps<Theme> = {
  color: 'text.primary',
  fontWeight: 700,
  lineHeight: 1.1,
};

export const designerInfoIconSx: SxProps<Theme> = {
  color: '#FFFFFF',
  backgroundColor: '#6499E8',
  borderRadius: '50%',
  p: 0.32,
  fontSize: '1.1rem',
  ml: 0.2,
  boxShadow: '0 1px 2px rgba(10, 53, 111, 0.25)',
  verticalAlign: 'middle',
};

export const designerDividerSx: SxProps<Theme> = {
  borderColor: 'divider',
  borderWidth: 1.25,
  mx: -3,
};

export const designerControlLabelSx: SxProps<Theme> = {
  color: 'text.secondary',
  fontWeight: 700,
  textTransform: 'none',
  fontSize: '1.05rem',
  letterSpacing: '0.01em',
  whiteSpace: 'nowrap',
  '& .MuiSvgIcon-root': {
    fontSize: '1.55rem',
  },
};

export const designerScrollableControlRowSx: SxProps<Theme> = {
  width: '100%',
  flexWrap: 'wrap',
  pb: 0.25,
  rowGap: 0.6,
};

export const designerControlActionRowSx: SxProps<Theme> = {
  ...designerScrollableControlRowSx,
  mt: 0.5,
};

export const designerIconControlButtonSx: SxProps<Theme> = {
  color: 'text.secondary',
  p: 0.5,
};

export const designerPrimaryActionButtonSx: SxProps<Theme> = {
  textTransform: 'none',
  fontWeight: 700,
};

export const designerControlHeadingSx: SxProps<Theme> = {
  color: 'text.primary',
  fontWeight: 700,
  fontSize: '1.25rem',
  lineHeight: 1.2,
  whiteSpace: 'nowrap',
};

export const designerFieldSubHeadingSx: SxProps<Theme> = {
  color: 'text.primary',
  fontWeight: 700,
  fontSize: '1.25rem',
  lineHeight: 1.2,
  textAlign: 'left',
};

export const designerSubheadingSx: SxProps<Theme> = {
  color: 'text.secondary',
  fontWeight: 600,
  fontSize: '1rem',
  lineHeight: 1.5,
};

export const designerPipeSx: SxProps<Theme> = {
  color: 'text.disabled',
  px: 0.1,
};

export const designerResponsiveFrameSx = {
  width: '100%',
  maxWidth: '100%',
  mx: 'auto',
} as const;

export const designerResponsiveSectionSx = {
  width: '100%',
  maxWidth: '100%',
  mx: 'auto',
} as const;

export const designerResponsiveFieldEditorSx = {
  width: '100%',
  maxWidth: '100%',
} as const;

// ── Dialog / modal shared styles ──────────────────────────────────────────

/** Styled DialogTitle header with a subtle primary-tinted background. */
export const designerDialogTitleSx: SxProps<Theme> = {
  py: 2,
  px: {xs: 2, sm: 3},
  borderBottom: '1px solid',
  borderColor: 'divider',
  backgroundColor: (t: Theme) =>
    alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.2 : 0.08),
};

export const designerCancelButtonSx: SxProps<Theme> = {
  textTransform: 'none',
  fontWeight: 600,
  color: 'text.secondary',
  border: '1px solid',
  borderColor: 'divider',
  '&:hover': {
    backgroundColor: (t: Theme) => alpha(t.palette.text.secondary, 0.08),
    borderColor: 'text.disabled',
  },
};

export const designerDialogActionsSx: SxProps<Theme> = {
  px: {xs: 2, sm: 3},
  pb: {xs: 2, sm: 2.5},
  pt: 1.5,
  gap: 1,
};

export const designerDialogFieldLabelSx: SxProps<Theme> = {
  fontWeight: 600,
  color: 'text.secondary',
  fontSize: '0.875rem',
  mb: 0.75,
  mt: 1.5,
};

/** Secondary body text inside dialogs. */
export const designerDialogBodyTextSx: SxProps<Theme> = {
  color: 'text.secondary',
  fontSize: '0.875rem',
  lineHeight: 1.5,
  mb: 1.5,
};
