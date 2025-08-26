import {UpdateLongLivedTokenForm} from '@/components/forms/long-lived-tokens/update-long-lived-token-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {GetLongLivedTokensResponse} from '@faims3/data-model';

interface UpdateLongLivedTokenDialogProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  token: GetLongLivedTokensResponse['tokens'][number];
}

export const UpdateLongLivedTokenDialog = ({
  open,
  setOpen,
  token,
}: UpdateLongLivedTokenDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Long Lived API Token</DialogTitle>
          <DialogDescription>
            Update the title and description for "{token.title}".
          </DialogDescription>
        </DialogHeader>
        <UpdateLongLivedTokenForm setDialogOpen={setOpen} token={token} />
      </DialogContent>
    </Dialog>
  );
};
