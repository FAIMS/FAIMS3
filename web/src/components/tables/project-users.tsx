import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {RoleCard} from '../ui/role-card';
import {AddRolePopover} from '../popovers/add-role-popover';
import {ProjectRoleCard} from '../project-role-card';
import {RemoveUserFromProjectDialog} from '../dialogs/remove-user-from-project-dialog';

export const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'name',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'team-roles',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Team Roles" />
    ),
    cell: ({row}: any) => (
      <div className="flex flex-wrap gap-1">
        {row.getValue('team-roles').map((role: string) => (
          <RoleCard key={role}>{role}</RoleCard>
        ))}
      </div>
    ),
  },
  {
    accessorKey: 'project-roles',
    header: ({column}) => (
      <DataTableColumnHeader
        column={column}
        title={`${NOTEBOOK_NAME_CAPITALIZED} Roles`}
      />
    ),
    cell: ({row}: any) => (
      <div className="flex flex-wrap gap-1">
        {row.getValue('project-roles').map((role: string) => (
          <ProjectRoleCard key={role} userId={row.original.user_id} role={role}>
            {role}
          </ProjectRoleCard>
        ))}
        <AddRolePopover
          roles={['user', 'team', 'moderator', 'admin'].filter(
            role => row.getValue('project-roles').indexOf(role) === -1
          )}
          userId={row.original.user_id}
        />
      </div>
    ),
  },
  {
    id: 'remove',
    cell: ({
      row: {
        original: {_id, 'project-roles': roles},
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
