/**
 * @file Modal listing condition references that block delete until the user fixes them.
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Button,
} from '@mui/material';
import {
  designerCancelButtonSx,
  designerDialogActionsSx,
  designerDialogTitleSx,
} from './designer-style';

type DeletionWarningDialogProps = {
  open: boolean;
  title: string;
  references: string[];
  onClose: () => void;
};

/** Read-only warning when delete is blocked by visibility conditions elsewhere. */
export const DeletionWarningDialog = ({
  open,
  title,
  references,
  onClose,
}: DeletionWarningDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={designerDialogTitleSx}>{title}</DialogTitle>
      <DialogContent sx={{pt: 2.5, px: {xs: 2, sm: 3}}}>
        <Alert severity="warning">
          This item is referenced in the following conditions:
          <ul style={{marginTop: 8}}>
            {references.map((ref, idx) => (
              <li key={idx}>{ref}</li>
            ))}
          </ul>
          Please remove or update these references before deleting.
        </Alert>
      </DialogContent>
      <DialogActions sx={designerDialogActionsSx}>
        <Button sx={designerCancelButtonSx} onClick={onClose}>
          OK
        </Button>
      </DialogActions>
    </Dialog>
  );
};
