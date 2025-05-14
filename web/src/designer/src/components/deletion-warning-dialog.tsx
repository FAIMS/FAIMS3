import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Button,
} from '@mui/material';

type DeletionWarningDialogProps = {
  open: boolean;
  title: string;
  references: string[];
  onClose: () => void;
};

export const DeletionWarningDialog = ({
  open,
  title,
  references,
  onClose,
}: DeletionWarningDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
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
      <DialogActions>
        <Button onClick={onClose}>OK</Button>
      </DialogActions>
    </Dialog>
  );
};
