// SPDX-License-Identifier: Apache-2.0
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
import {deleteMapAsset, invalidateMapAssets} from '@/hooks/map-asset-hooks';
import {useNavigate} from '@tanstack/react-router';
import {useQueryClient} from '@tanstack/react-query';
import {Trash2} from 'lucide-react';
import {useState} from 'react';
import {toast} from 'sonner';

/** Confirm-and-delete dialog for one library layer. */
export function DeleteMapLayerDialog({assetId}: {assetId: string}) {
  const user = useRequiredUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const onDelete = async () => {
    setPending(true);
    try {
      await deleteMapAsset({user, assetId});
      await invalidateMapAssets(queryClient, user, assetId);
      setOpen(false);
      toast.success('Map layer deleted');
      await navigate({to: '/map-layers'});
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Delete failed.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild className="w-fit">
        <Button variant="destructive">
          Delete map layer
          <Trash2 className="ml-1 h-4 w-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this map layer?</DialogTitle>
          <DialogDescription>
            Surveys stop listing it. Devices drop the downloaded file the next
            time those surveys refresh their layers.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() => void onDelete()}
          >
            {pending ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
