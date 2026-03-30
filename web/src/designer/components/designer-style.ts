import {SxProps, Theme} from '@mui/material';

export const designerHeadingRowSx: SxProps<Theme> = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

export const designerHeadingTextSx: SxProps<Theme> = {
  color: 'text.primary',
  fontWeight: 800,
  lineHeight: 1.1,
};

export const designerInfoIconSx: SxProps<Theme> = {
  color: '#1E88E5',
};

export const designerDividerSx: SxProps<Theme> = {
  borderColor: '#90A4AE',
  borderWidth: 2,
};

export const designerControlLabelSx: SxProps<Theme> = {
  color: 'text.secondary',
  fontWeight: 700,
  textTransform: 'uppercase',
  fontSize: '0.75rem',
  letterSpacing: '0.03em',
};

export const designerPipeSx: SxProps<Theme> = {
  color: 'text.disabled',
  px: 0.1,
};
