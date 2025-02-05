import {ColumnDef} from '@tanstack/react-table';

export const columns: ColumnDef<any>[] = [
  {header: 'Role'},
  {header: 'Uses'},
  {header: 'Remaining'},
  {header: 'Expiry'},
  {header: 'Access Code'},
  {header: 'QR Code'},
  {header: 'Delete'},
];
