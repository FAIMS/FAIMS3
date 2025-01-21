import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const NewTemplateDialog = () => {
  /**
    Component: NewTemplateDialogComponent
    
    TODO flesh this out!
    */
  return (
    <DialogContent>
      <DialogHeader>
        <DialogClose>Cloose me fool</DialogClose>
        <DialogTitle>Are you absolutely sure?</DialogTitle>
        <DialogDescription>
          This action cannot be undone. This will permanently delete your
          account and remove your data from our servers.
        </DialogDescription>
      </DialogHeader>
    </DialogContent>
  );
};
