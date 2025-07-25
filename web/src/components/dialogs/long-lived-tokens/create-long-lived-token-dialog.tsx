import {CreateLongLivedTokenForm} from '@/components/forms/long-lived-tokens/create-long-lived-token-form';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Plus} from 'lucide-react';
import {useState} from 'react';
import {Button} from '../../ui/button';

export const CreateLongLivedTokenDialog = () => {
  const [open, setOpen] = useState(false);

  const [showCloseWarning, setShowCloseWarning] = useState(false);

  const handleInterceptClose = () => {
    setShowCloseWarning(true);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && showCloseWarning) {
      // Show confirmation dialog
      const confirmed = window.confirm(
        "Are you sure you want to close? Your API token will be lost forever if you haven't saved it."
      );
      if (confirmed) {
        setOpen(false);
        setShowCloseWarning(false);
      }
    } else {
      setOpen(open);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild className="w-fit">
        <Button
          variant="outline"
          className="bg-primary text-primary-foreground"
        >
          <Plus />
          Create Long Lived Token
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Long Lived API Token</DialogTitle>
          <DialogDescription>
            Create a new Long Lived API Token for accessing the system APIs.
          </DialogDescription>
        </DialogHeader>
        <CreateLongLivedTokenForm
          setDialogOpen={setOpen}
          onInterceptClose={handleInterceptClose}
        />
      </DialogContent>
    </Dialog>
  );
};
