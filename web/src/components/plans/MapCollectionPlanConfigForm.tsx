/**
 * @file Config form for a Map Collection plan: upload a spatial file (GeoJSON
 * for now) holding one feature per planned record, run it through the spatial
 * import pipeline, and preview the entries it yields.
 */

import {useCallback, useEffect, useMemo, useState} from 'react';
import {
  getSpatialFormatAdapters,
  mapCollectionPlanTemplateConfigSchema,
  parseSpatialImport,
  PLAN_GEOMETRY_TYPES,
  type MapCollectionPlanEntry,
  type MapCollectionRecordField,
  type PlanGeometryType,
  type SpatialImportContext,
  type SpatialImportError,
  type SpatialImportFormat,
} from '@faims3/data-model';
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
import {config} from '@/constants';
import {fieldLabel, formLabel, type PlanConfigFormProps} from './types';

/** A short description of an entry's geometry, e.g. "Point" or "Point × 3". */
export const geometrySummary = (entry: MapCollectionPlanEntry): string => {
  const counts = new Map<string, number>();
  for (const feature of entry.spatial.features) {
    counts.set(
      feature.geometry.type,
      (counts.get(feature.geometry.type) ?? 0) + 1
    );
  }
  return [...counts.entries()]
    .map(([type, count]) => (count > 1 ? `${type} × ${count}` : type))
    .join(', ');
};

/** The spatial field's stored feature type, for a MapFormField that names one. */
const spatialFeatureType = (
  featureType: unknown
): PlanGeometryType | undefined =>
  (PLAN_GEOMETRY_TYPES as readonly string[]).includes(String(featureType))
    ? (featureType as PlanGeometryType)
    : undefined;

/** Read a file as text and parse it as JSON, or explain why that failed. */
const readJsonFile = async (
  file: File
): Promise<{ok: true; value: unknown} | {ok: false; message: string}> => {
  if (file.size > config.maxDesignFileSizeBytes) {
    return {
      ok: false,
      message: `File must be at most ${config.maxDesignFileSizeMb} MB.`,
    };
  }
  try {
    return {ok: true, value: JSON.parse(await file.text())};
  } catch {
    return {ok: false, message: 'The file is not valid JSON.'};
  }
};

export const MapCollectionPlanConfigForm = ({
  template,
  uiSpec,
  onChange,
}: PlanConfigFormProps) => {
  const adapters = getSpatialFormatAdapters();
  const [format, setFormat] = useState<SpatialImportFormat>(adapters[0].format);
  const [fileName, setFileName] = useState<string | null>(null);
  const [recordData, setRecordData] = useState<
    Record<string, MapCollectionPlanEntry> | undefined
  >();
  const [errors, setErrors] = useState<SpatialImportError[]>([]);
  const [allowExtraRecords, setAllowExtraRecords] = useState(false);

  const targetForm = formLabel(uiSpec, template.formType as string);
  const recordFields =
    (template.recordFields as MapCollectionRecordField[]) ?? [];
  const spatialFieldId = template.spatialFieldId as string;
  const spatialField = uiSpec.fields[spatialFieldId];

  const context = useMemo<SpatialImportContext>(
    () => ({
      template: {recordFields, spatialFieldId},
      fieldTypes: Object.fromEntries(
        recordFields.map(f => [
          f.fieldId,
          uiSpec.fields[f.fieldId]?.['type-returned'],
        ])
      ),
      spatial: {
        componentName: spatialField?.['component-name'],
        featureType:
          spatialField?.['component-name'] === 'MapFormField'
            ? // The designer's MapFormField defaults to a point when unset
              (spatialFeatureType(
                spatialField?.['component-parameters']?.featureType
              ) ?? 'Point')
            : undefined,
      },
    }),
    [template, uiSpec]
  );

  useEffect(() => {
    if (!recordData || Object.keys(recordData).length === 0) {
      onChange(undefined);
      return;
    }
    const result = mapCollectionPlanTemplateConfigSchema.safeParse({
      recordData,
      allowExtraRecords,
    });
    onChange(result.success ? result.data : undefined);
  }, [recordData, allowExtraRecords, onChange]);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      setRecordData(undefined);
      setErrors([]);
      setFileName(file?.name ?? null);
      if (!file) return;
      const read = await readJsonFile(file);
      if (!read.ok) {
        setErrors([{message: read.message}]);
        return;
      }
      const result = parseSpatialImport({format, source: read.value, context});
      if (result.ok) setRecordData(result.recordData);
      else setErrors(result.errors);
    },
    [format, context]
  );

  const entries = recordData ? Object.entries(recordData) : [];
  const accept = adapters.find(a => a.format === format)?.accept.join(',');

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Upload a spatial file with one feature per planned {targetForm} record.
        Each feature's geometry fills{' '}
        <span className="font-medium">
          {fieldLabel(uiSpec, spatialFieldId)}
        </span>
        {recordFields.length > 0 && (
          <>
            {' '}
            and its attributes pre-fill{' '}
            {recordFields
              .map(
                f =>
                  `${fieldLabel(uiSpec, f.fieldId)}${f.required ? ' (required)' : ''}`
              )
              .join(', ')}
            , matched by field id
          </>
        )}
        .
      </p>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`plan-spatial-format-${template.planId}`}>
            Format
          </Label>
          <select
            id={`plan-spatial-format-${template.planId}`}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={format}
            onChange={event =>
              setFormat(event.target.value as SpatialImportFormat)
            }
            data-testid="plan-config-spatial-format"
          >
            {adapters.map(adapter => (
              <option key={adapter.format} value={adapter.format}>
                {adapter.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 grow">
          <Label htmlFor={`plan-spatial-file-${template.planId}`}>
            Spatial file
          </Label>
          <Input
            id={`plan-spatial-file-${template.planId}`}
            type="file"
            accept={accept}
            className="cursor-pointer"
            onChange={event => handleFile(event.target.files?.[0])}
            data-testid="plan-config-spatial-file"
          />
        </div>
      </div>

      {errors.length > 0 && (
        <div
          className="rounded-md border border-destructive/50 p-3 text-sm text-destructive"
          role="alert"
        >
          <p className="font-medium">
            {fileName
              ? `${fileName} cannot be used`
              : 'The file cannot be used'}
            :
          </p>
          <ul className="list-disc pl-5 mt-1">
            {errors.map((error, i) => (
              <li key={i}>
                {error.index !== undefined
                  ? `Feature ${error.index + 1}: `
                  : ''}
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {entries.length > 0 && (
        <>
          <p className="text-sm" data-testid="plan-config-spatial-summary">
            {entries.length} planned {targetForm} record
            {entries.length === 1 ? '' : 's'} read from {fileName}.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                {recordFields.map(f => (
                  <TableHead key={f.fieldId}>
                    {fieldLabel(uiSpec, f.fieldId)}
                  </TableHead>
                ))}
                <TableHead>Geometry</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map(([reference, entry]) => (
                <TableRow key={reference}>
                  <TableCell className="whitespace-nowrap">
                    {reference}
                  </TableCell>
                  {recordFields.map(f => (
                    <TableCell key={f.fieldId}>
                      {entry.fields[f.fieldId] === undefined
                        ? ''
                        : String(entry.fields[f.fieldId])}
                    </TableCell>
                  ))}
                  <TableCell className="whitespace-nowrap">
                    {geometrySummary(entry)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

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
