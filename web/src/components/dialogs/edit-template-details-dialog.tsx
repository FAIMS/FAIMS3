// SPDX-License-Identifier: Apache-2.0
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {useAuth} from '@/context/auth-provider';
import {useGetTemplate} from '@/hooks/queries';
import {Route} from '@/routes/_protected/templates/$templateId';
import {EditTemplateDetailsForm} from '@/components/forms/edit-template-details-form';
import {LoaderCircleIcon, Pencil} from 'lucide-react';
import {useState} from 'react';

/**
 * Dialog to edit template name and description (PUT /api/templates/:id metadata only).
 */
export const EditTemplateDetailsDialog = () => {
  const {user} = useAuth();
  const {templateId} = Route.useParams();
  const {data, isLoading, isError} = useGetTemplate({user, templateId});
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button disabled={isLoading}>
          <Pencil aria-hidden />
          Edit name &amp; description
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit template details</DialogTitle>
          <DialogDescription>
            Update the listing title and short description. Form design and
            design prose stay in the template editor.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <LoaderCircleIcon className="animate-spin" aria-label="Loading" />
        ) : isError || !data ? (
          <p className="text-sm text-destructive">
            Could not load template details.
          </p>
        ) : (
          <EditTemplateDetailsForm
            templateId={templateId}
            name={data.name}
            description={data.description}
            setDialogOpen={setOpen}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};
