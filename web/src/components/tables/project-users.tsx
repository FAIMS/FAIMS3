import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';

import {NOTEBOOK_NAME_CAPITALIZED} from '@/constants';
import {RemoveUserFromSurveyDialog} from '../dialogs/remove-user-from-survey-dialog';

export const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'name',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'team-role',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Team Role" />
    ),
  },
  {
    accessorKey: 'survey-role',
    header: ({column}) => (
      <DataTableColumnHeader
        column={column}
        title={`${NOTEBOOK_NAME_CAPITALIZED} Role`}
      />
    ),
  },
  {
    id: 'remove',
    cell: () => (
      <div className="flex justify-center items-center -my-2">
        <RemoveUserFromSurveyDialog userId="" />
      </div>
    ),
    header: () => (
      <div className="flex justify-center items-center">Remove</div>
    ),
  },
];
