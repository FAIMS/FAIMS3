import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {RoleCard} from '../ui/role-card';
import {CopyButton} from '../ui/copy-button';
import {QRCodeDialog} from '../dialogs/qr-code-dialog';
import {GetTeamInvitesResponse, roleDetails} from '@faims3/data-model';
import {displayUnixTimestampMs} from '@/lib/utils';

export const columns: ColumnDef<
  GetTeamInvitesResponse[number] & {url: string; qrCode: string}
>[] = [
  {
    accessorKey: 'name',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'expiry',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({
      row: {
        original: {expiry},
      },
    }) => displayUnixTimestampMs({timestamp: expiry}),
  },
  {
    accessorKey: 'role',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({
      row: {
        original: {role},
      },
    }) => <RoleCard>{roleDetails[role].name}</RoleCard>,
  },
  {
    accessorKey: 'code',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Code" />
    ),
    cell: ({
      row: {
        original: {_id},
      },
    }) => (
      <div>
        <CopyButton value={_id}>
          <code>{_id}</code>
        </CopyButton>
      </div>
    ),
  },
  {
    accessorKey: 'url',
    header: 'Link',
    cell: ({
      row: {
        original: {_id, url},
      },
    }) => {
      return (
        <CopyButton value={url}>
          <code>link:{_id}</code>
        </CopyButton>
      );
    },
  },
  {
    accessorKey: 'qrCode',
    header: () => <div className="flex justify-center">QR Code</div>,
    cell: ({
      row: {
        original: {qrCode},
      },
    }) => (
      <div className="flex justify-center">
        <QRCodeDialog src={qrCode} />
      </div>
    ),
  },
];
