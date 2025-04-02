import {ColumnDef} from '@tanstack/react-table';
import {DataTableColumnHeader} from '../data-table/column-header';
import {RoleCard} from '../ui/role-card';
import {CopyButton} from '../ui/copy-button';
import {QRCodeDialog} from '../dialogs/qr-code-dialog';
import {roleLabel} from '@/lib/utils';

export const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'role',
    header: ({column}) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({
      row: {
        original: {role},
      },
    }: any) => <RoleCard>{roleLabel(role)}</RoleCard>,
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
    }: any) => (
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
    }: any) => {
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
    }: any) => (
      <div className="flex justify-center">
        <QRCodeDialog src={qrCode} />
      </div>
    ),
  },
];
