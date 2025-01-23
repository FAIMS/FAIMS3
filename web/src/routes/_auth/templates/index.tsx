import {createFileRoute, useNavigate} from '@tanstack/react-router';
import {DataTable} from '@/components/data-table/data-table';
import {columns} from '@/components/tables/templates';
import {useAuth} from '@/auth';
import {useGetTemplates} from '@/lib/queries';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {ZodBooleanDef} from 'zod';
import {useState} from 'react';
import {NewTemplateDialog} from '@/components/dialogs/new-template';
import {Plus} from 'lucide-react';

export const Route = createFileRoute('/_auth/templates/')({
  component: RouteComponent,
});

function RouteComponent() {
  const {user} = useAuth();

  if (!user) return <></>;

  const {isPending, error, data} = useGetTemplates(user);

  const navigate = useNavigate();

  console.log(data);

  return (
    <Dialog>
      <DataTable
        columns={columns}
        data={data}
        loading={isPending}
        onRowClick={({_id}) => navigate({to: `/templates/${_id}`})}
        // OnAddComponent={
        //   <DialogTrigger className="w-fit">
        //     <Button variant="default">
        //       New Template
        //       <Plus className="h-4 w-4" />
        //     </Button>
        //   </DialogTrigger>
        // }
      />
      <NewTemplateDialog />
    </Dialog>
  );
}
