/**
 * @file Config form for a List of Records plan: an editable table with one
 * column per pre-filled field and one row per planned record.
 */

import {useEffect, useRef, useState} from 'react';
import {Plus, Trash2} from 'lucide-react';
import {listPlanTemplateConfigSchema} from '@faims3/data-model';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fieldLabel,
  formLabel,
  SUPPORTED_RECORD_FIELD_TYPES,
  type PlanConfigFormProps,
} from './types';

type Row = {ref: string; values: Record<string, unknown>};

type CellKind = 'number' | 'boolean' | 'text';

// Input kind from the field's declared return type; anything else is text
const cellKind = (typeReturned?: string): CellKind => {
  if (
    typeReturned === 'faims-core::Integer' ||
    typeReturned === 'faims-core::Number'
  )
    return 'number';
  if (typeReturned === 'faims-core::Bool') return 'boolean';
  return 'text';
};

const isSupported = (typeReturned?: string) =>
  (SUPPORTED_RECORD_FIELD_TYPES as readonly string[]).includes(
    typeReturned ?? ''
  );

export const ListOfRecordsPlanConfigForm = ({
  template,
  uiSpec,
  onChange,
}: PlanConfigFormProps) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [allowExtraRecords, setAllowExtraRecords] = useState(false);
  // Monotonic so a removed row's reference is never reused
  const nextRef = useRef(1);

  const recordFields = (template.recordFields as string[]) ?? [];
  const targetForm = formLabel(uiSpec, template.formType as string);

  useEffect(() => {
    if (rows.length === 0) {
      onChange(undefined);
      return;
    }
    const result = listPlanTemplateConfigSchema.safeParse({
      recordData: Object.fromEntries(rows.map(row => [row.ref, row.values])),
      allowExtraRecords,
    });
    onChange(result.success ? result.data : undefined);
  }, [rows, allowExtraRecords, onChange]);

  const addRow = () => {
    setRows(current => [
      ...current,
      {ref: `planned-${nextRef.current++}`, values: {}},
    ]);
  };

  const removeRow = (ref: string) => {
    setRows(current => current.filter(row => row.ref !== ref));
  };

  // Empty cells are left out of the record rather than stored as ''
  const setCell = (ref: string, field: string, value: unknown) => {
    setRows(current =>
      current.map(row => {
        if (row.ref !== ref) return row;
        const values = {...row.values};
        if (value === '' || value === undefined) delete values[field];
        else values[field] = value;
        return {...row, values};
      })
    );
  };

  const renderCell = (row: Row, field: string) => {
    const kind = cellKind(uiSpec.fields[field]?.['type-returned']);
    const value = row.values[field];
    if (kind === 'boolean') {
      return (
        <Checkbox
          checked={value === true}
          onCheckedChange={checked => setCell(row.ref, field, checked === true)}
          aria-label={`${fieldLabel(uiSpec, field)} for ${row.ref}`}
        />
      );
    }
    return (
      <Input
        type={kind === 'number' ? 'number' : 'text'}
        value={value === undefined ? '' : String(value)}
        onChange={event => {
          const raw = event.target.value;
          setCell(
            row.ref,
            field,
            kind === 'number' ? (raw === '' ? '' : Number(raw)) : raw
          );
        }}
        aria-label={`${fieldLabel(uiSpec, field)} for ${row.ref}`}
      />
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Each row becomes a planned {targetForm} record with these values
        pre-filled.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            {recordFields.map(field => {
              const typeReturned = uiSpec.fields[field]?.['type-returned'];
              return (
                <TableHead key={field}>
                  {fieldLabel(uiSpec, field)}
                  {!isSupported(typeReturned) && (
                    <span
                      className="block text-xs font-normal text-amber-600"
                      title={`Entered as text; ${typeReturned ?? 'this type'} is not supported yet`}
                    >
                      entered as text
                    </span>
                  )}
                </TableHead>
              );
            })}
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(row => (
            <TableRow key={row.ref}>
              <TableCell className="whitespace-nowrap">{row.ref}</TableCell>
              {recordFields.map(field => (
                <TableCell key={field}>{renderCell(row, field)}</TableCell>
              ))}
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${row.ref}`}
                  onClick={() => removeRow(row.ref)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={recordFields.length + 2}
                className="text-center text-muted-foreground"
              >
                No planned records yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addRow}
          data-testid="plan-config-add-record"
        >
          <Plus className="h-4 w-4" /> Add record
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id={`plan-allow-extra-${template.planId}`}
          checked={allowExtraRecords}
          onCheckedChange={value => setAllowExtraRecords(value === true)}
          data-testid="plan-config-allow-extra"
        />
        <Label
          htmlFor={`plan-allow-extra-${template.planId}`}
          className="font-normal cursor-pointer"
        >
          Allow records beyond the planned list
        </Label>
      </div>
    </div>
  );
};
