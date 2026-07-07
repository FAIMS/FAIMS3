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
  // Shared info-marker style used across Designer.
  // Use the icon's native circular glyph (no extra wrapper), to avoid double-ring visuals.
  color: '#1FB1FF',
  fontSize: '1.7rem',
  ml: 0.28,
  verticalAlign: 'middle',
  filter: 'drop-shadow(0 4px 8px rgba(31, 177, 255, 0.25))',
};

/**
 * Shared checkbox style for all Designer checkboxes.
 * Intentionally simple: light primary tint, grey by default, green when checked.
 */
export const designerCheckboxSx: SxProps<Theme> = {
  color: 'grey.500',
  '&.Mui-checked': {
    color: 'success.main',
  },
  '&.Mui-disabled': {
    color: 'grey.400',
  },
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

export const designerInlineEditFocusOverlaySx: SxProps<Theme> = {
  position: 'fixed',
  inset: 0,
  zIndex: 1200,
  backgroundColor: 'rgba(8, 18, 29, 0.1)',
  backdropFilter: 'blur(1.5px)',
};

export const designerInlineEditPanelSx: SxProps<Theme> = {
  position: 'relative',
  zIndex: 1201,
  width: 'fit-content',
  maxWidth: {xs: '100%', sm: '36rem'},
  backgroundColor: 'background.paper',
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 1.25,
  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.16)',
  px: {xs: 1.5, sm: 2},
  py: {xs: 1, sm: 1.25},
  mb: 1,
};

export const designerInlineEditActionIconSx: SxProps<Theme> = {
  color: 'text.secondary',
  borderRadius: 1,
  p: 0.5,
  '& .MuiSvgIcon-root': {
    fontSize: '1.95rem',
    fontWeight: 900,
  },
  '&:hover': {
    backgroundColor: (theme: Theme) => alpha(theme.palette.text.primary, 0.08),
  },
};

export const designerPrimaryActionButtonSx: SxProps<Theme> = {};

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
  py: 2.35,
  px: {xs: 2.25, sm: 3.25},
  borderBottom: '1px solid',
  borderColor: 'divider',
  backgroundColor: (t: Theme) =>
    alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.2 : 0.08),
};

export const designerCancelButtonSx: SxProps<Theme> = {
  textTransform: 'none',
  fontWeight: 700,
  color: 'text.secondary',
  backgroundColor: 'grey.100',
  border: '1px solid',
  borderColor: 'grey.400',
  '&:hover': {
    backgroundColor: 'grey.200',
    borderColor: 'grey.500',
  },
  '&.Mui-disabled': {
    color: 'text.disabled',
    backgroundColor: 'grey.100',
    borderColor: 'grey.300',
  },
};

export const designerDialogActionsSx: SxProps<Theme> = {
  px: {xs: 2.25, sm: 3.25},
  pb: {xs: 2.25, sm: 2.75},
  pt: 1.75,
  gap: 1,
};

export const designerDialogFieldLabelSx: SxProps<Theme> = {
  fontWeight: 600,
  color: 'text.secondary',
  fontSize: '0.875rem',
  mb: 0.9,
  mt: 2.1,
};

/** Secondary body text inside dialogs. */
export const designerDialogBodyTextSx: SxProps<Theme> = {
  color: 'text.secondary',
  fontSize: '0.875rem',
  lineHeight: 1.5,
  mb: 1.65,
};

export const designerDialogContentSx: SxProps<Theme> = {
  pt: 4,
  px: {xs: 2.25, sm: 3.25},
  pb: 2.5,
};

export const designerInfoCalloutSx: SxProps<Theme> = {
  mt: 1.5,
  borderRadius: 1.5,
  border: '1px solid',
  borderColor: (theme: Theme) => alpha(theme.palette.text.primary, 0.12),
  backgroundColor: (theme: Theme) => alpha(theme.palette.text.primary, 0.025),
  boxShadow: (theme: Theme) =>
    `0 1px 5px ${alpha(theme.palette.common.black, 0.05)}, inset 0 1px 0 ${alpha(
      theme.palette.common.white,
      0.74
    )}`,
  color: 'text.primary',
};

/**  light card surface used by field panels and helper areas. */
export const designerSoftPanelCardSx: SxProps<Theme> = {
  borderColor: 'divider',
  boxShadow: (theme: Theme) =>
    `0 1px 6px ${alpha(theme.palette.common.black, 0.045)}, inset 0 1px 0 ${alpha(
      theme.palette.common.white,
      0.78
    )}`,
};

/** Fuzzy-search match emphasis inside autocomplete option labels. */
export const designerSearchMatchHighlightSx: SxProps<Theme> = {
  '& strong': {
    color: theme => theme.designerMeta.tokens.searchMatchHighlight,
    fontWeight: 700,
  },
};

/** Keyboard shortcut hint badge shown in the global design search field. */
export const designerSearchShortcutHintSx: SxProps<Theme> = {
  fontSize: '0.72rem',
  lineHeight: 1,
  px: 0.75,
  py: 0.375,
  borderRadius: 0.75,
  border: 1,
  borderColor: 'divider',
  bgcolor: 'action.hover',
  color: 'text.secondary',
  fontFamily: 'inherit',
  pointerEvents: 'none',
  userSelect: 'none',
};

/** Dashed frame around nested condition editors. */
export const designerConditionFrameSx: SxProps<Theme> = {
  border: '1px dashed',
  borderColor: 'divider',
  p: 1.25,
};
