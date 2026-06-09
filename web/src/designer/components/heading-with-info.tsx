import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Typography,
} from '@mui/material';
import Box from '@mui/material/Box';
import {useState, type ReactNode} from 'react';
import {
  designerHeadingRowSx,
  designerHeadingTextSx,
  designerInfoIconSx,
} from './designer-style';

type HeadingWithInfoProps = {
  title: string;
  tooltip: ReactNode;
  variant?: 'h2' | 'subtitle1' | 'body1' | 'body2';
  titleSx?: Record<string, unknown>;
  containerSx?: Record<string, unknown>;
  iconSx?: Record<string, unknown>;
  /** Open as a centered modal instead of a hover tooltip. */
  modal?: boolean;
};

export const HeadingWithInfo = ({
  title,
  tooltip,
  variant = 'h2',
  titleSx,
  containerSx,
  iconSx,
  modal = false,
}: HeadingWithInfoProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Box
      sx={{
        ...(designerHeadingRowSx as Record<string, unknown>),
        ...(containerSx ?? {}),
      }}
    >
      <Typography
        variant={variant}
        sx={{
          ...(designerHeadingTextSx as Record<string, unknown>),
          ...(titleSx ?? {}),
        }}
      >
        {title}
      </Typography>
      {modal ? (
        <>
          <IconButton
            size="small"
            aria-label={`More info about ${title}`}
            onClick={() => setDialogOpen(true)}
            onMouseEnter={() => setDialogOpen(true)}
            sx={{p: 0.25}}
          >
            <InfoIcon
              sx={{
                ...(designerInfoIconSx as Record<string, unknown>),
                ...(iconSx ?? {}),
              }}
            />
          </IconButton>
          <Dialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            fullWidth
            maxWidth="md"
            slotProps={{paper: {sx: {borderRadius: 2, p: 1}}}}
          >
            <DialogTitle sx={{fontWeight: 'bold', pr: 6}}>
              {title}
              <IconButton
                aria-label="Close"
                onClick={() => setDialogOpen(false)}
                sx={{position: 'absolute', right: 16, top: 16}}
              >
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{maxHeight: '60vh', overflowY: 'auto'}}>
              <Box sx={{fontSize: '1rem', lineHeight: 1.6}}>{tooltip}</Box>
            </DialogContent>
            <DialogActions sx={{px: 3, py: 2}}>
              <Button
                onClick={() => setDialogOpen(false)}
                variant="contained"
                sx={{fontWeight: 'bold', textTransform: 'none', px: 3}}
              >
                Close
              </Button>
            </DialogActions>
          </Dialog>
        </>
      ) : (
        <Tooltip title={tooltip}>
          <InfoIcon
            sx={{
              ...(designerInfoIconSx as Record<string, unknown>),
              ...(iconSx ?? {}),
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
};
