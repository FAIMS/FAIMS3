import {SxProps, Theme} from '@mui/material';

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
  color: 'info.main',
  fontSize: '1.35rem',
  ml: 0.1,
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
