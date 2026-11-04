// SPDX-License-Identifier: Apache-2.0
import {UpdateMapLayerDetailsForm} from '@/components/forms/update-map-layer-details-form';
import {Button} from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {useRequiredUser} from '@/hooks/auth-hooks';
import {useMapAsset} from '@/hooks/map-asset-hooks';
import {Pencil} from 'lucide-react';
import {useState} from 'react';

/** Dialog wrapping {@link UpdateMapLayerDetailsForm} for one layer. */
export function EditMapLayerDetailsDialog({assetId}: {assetId: string}) {
  const user = useRequiredUser();
  const {data, isLoading, isError} = useMapAsset({user, assetId});
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<{name: string; description: string}>();

  /** Snapshot current details when opening; drop the draft when closing. */
  const handleOpenChange = (next: boolean) => {
    if (next && data) {
      setDraft({name: data.name, description: data.description});
    }
    if (!next) {
      setDraft(undefined);
    }
    setOpen(next);
  };

  const formValues =
    draft ??
    (data ? {name: data.name, description: data.description} : undefined);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="outline" disabled={isLoading && !data}>
          Edit name &amp; description
          <Pencil className="ml-1 h-4 w-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit map layer details</DialogTitle>
          <DialogDescription>
            Update the listing name and description. The file itself stays the
            same.
          </DialogDescription>
        </DialogHeader>
        {isError || !formValues ? (
          <p className="text-sm text-destructive">
            Could not load map layer details.
          </p>
        ) : (
          <UpdateMapLayerDetailsForm
            assetId={assetId}
            name={formValues.name}
            description={formValues.description}
            setDialogOpen={value => {
              const next = typeof value === 'function' ? value(open) : value;
              handleOpenChange(next);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
