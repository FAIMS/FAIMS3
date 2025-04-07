import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {RoleCard} from '../ui/role-card';
import {Role, roleDetails} from '@faims3/data-model';
import {RemoveUserFromProjectDialog} from '../dialogs/remove-user-from-project-dialog';

export const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'name',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'globalRoles',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Global Roles" />
    ),
    cell: ({row}: any) => (
      <div className="flex flex-wrap gap-1">
        {row.getValue('globalRoles').map((role: string) => (
          <RoleCard key={role}>{roleDetails[role as Role].name}</RoleCard>
        ))}
      </div>
    ),
  },
  {
    accessorKey: 'projectRoles',
    header: ({column}) => (
      <DataTableColumnHeader
        column={column}
        title={`${NOTEBOOK_NAME_CAPITALIZED} Roles`}
      />
    ),
    cell: ({row}: any) => (
      <div className="flex flex-wrap gap-1">
        {row.getValue('projectRoles').map((role: string) => (
          <RoleCard key={role}>{role}</RoleCard>
        ))}
      </div>
    ),
  },
  {
    id: 'remove',
    cell: ({
      row: {
        original: {_id, projectRoles: roles},
      },
    }: any) => (
      <div className="flex justify-center items-center -my-2">
        <RemoveUserFromProjectDialog
          userId={_id}
          admin={roles.includes('admin')}
        />
      </div>
    ),
    header: () => (
      <div className="flex justify-center items-center">Remove</div>
    ),
  },
];
