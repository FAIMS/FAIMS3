import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {RoleCard} from '../ui/role-card';
import {GetNotebookUsersResponse, Role, roleDetails} from '@faims3/data-model';
import {RemoveUserFromProjectDialog} from '../dialogs/remove-user-from-project-dialog';

export const columns: ColumnDef<GetNotebookUsersResponse['users'][number]>[] = [
  {
    accessorKey: 'name',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
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
    cell: ({
      row: {
        original: {roles},
      },
    }) => (
      <div className="flex flex-wrap gap-1">
        {roles
          .filter(r => r.value)
          .map(r => (
            <RoleCard key={r.name}>{roleDetails[r.name].name}</RoleCard>
          ))}
      </div>
    ),
  },
  {
    id: 'remove',
    cell: ({
      row: {
        original: {username, roles},
      },
    }) => (
      <div className="flex justify-center items-center -my-2">
        <RemoveUserFromProjectDialog
          userId={username}
          admin={roles
            .filter(r => r.value)
            .map(r => r.name)
            .includes(Role.PROJECT_ADMIN)}
        />
      </div>
    ),
    header: () => (
      <div className="flex justify-center items-center">Remove</div>
    ),
  },
];
