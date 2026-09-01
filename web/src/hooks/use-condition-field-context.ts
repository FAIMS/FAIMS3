import {
  buildParentFieldTypes,
  buildRelatedFieldTypes,
  decodeParentRef,
  splitRelatedReference,
  UiSpecModel,
  decodeMetadataRef,
  encodeMetadataRef,
} from '@faims3/data-model';
import {
  FieldSearchScope,
  resolveFieldIdsInScope,
  FieldSearchEntry,
} from '@/designer/features/field-search';
import {useAppSelector} from '@/designer/state/hooks';
import {
  selectUiViews,
  selectUiViewSets,
  selectCustomMetadata,
} from '@/designer/store/selectors';
import {useMemo} from 'react';
import {getFieldLabel} from '@/lib/conditionUtils';
import type {FieldType} from '@/designer/state/initial';

/**
 * Display label for a condition field reference: local field, parent
 * reference (_PARENT.X), metadata reference (_METADATA.key) or related
 * reference (Rel.X). Falls back to the raw ID when nothing resolves.
 */
export const getConditionFieldLabel = (
  fieldId: string,
  allFields: Record<string, FieldType>
): string => {
  const local = allFields[fieldId];
  if (local) return getFieldLabel(local) ?? fieldId;
  const labelFor = (id: string) =>
    (allFields[id]?.['component-parameters']?.label as string) ?? id;
  const parentField = decodeParentRef(fieldId);
  if (parentField !== null) {
    return `Parent › ${labelFor(parentField)}`;
  }
  const metadataKey = decodeMetadataRef(fieldId);
  if (metadataKey !== null) {
    return `Notebook › ${metadataKey}`;
  }
  const parts = splitRelatedReference(fieldId);
  if (parts) {
    return `${labelFor(parts.relFieldId)} › ${labelFor(parts.fieldId)}`;
  }
  return fieldId;
};

/** Stand-in definition for a metadata reference: every value is text. */
const metadataFieldDef = (key: string): FieldType =>
  ({
    'component-namespace': 'faims-custom',
    'component-name': 'TextField',
    'type-returned': 'faims-core::String',
    'component-parameters': {label: key},
  }) as FieldType;

/**
 * Gets the field search scope and selectable field state for a condition rule.
 *
 * @param props - Current field or section condition context.
 * @returns Field map, search scope, and selectable field count.
 */
export const useConditionRuleFieldContext = (props: {
  field?: string;
  view?: string;
}) => {
  const allFields = useAppSelector(
    state => state.notebook.uiSpec.present.fields
  );

  const views = useAppSelector(selectUiViews);
  const viewsets = useAppSelector(selectUiViewSets);
  const custom = useAppSelector(selectCustomMetadata);

  // Work out which fields to show in the field selector. Conditions can only
  // reference fields within the same form, so scope the list to the current
  // form (viewset): resolve the entry context (props.field or props.view) to
  // its containing form, then gather every field across that form's sections
  // (mirrors TemplatedStringFieldEditor's viewSetFields). If the form can't be
  // resolved, show nothing rather than leaking other forms' fields. Then remove
  // either the current field or the fields in the current view.
  const fieldSearchScope = useMemo((): FieldSearchScope => {
    // Which section's condition are we editing?
    if (props.view) {
      return {kind: 'context', sectionId: props.view};
    }

    if (props.field) {
      return {kind: 'context', fieldId: props.field};
    }
    // Standalone use, no context: nothing to scope to, show all fields.
    return {kind: 'all'};
  }, [props.view, props.field]);

  // Resolve the form this condition belongs to, matching the scope logic:
  // a section condition names its section; a field condition names a field
  // whose section we look up.
  const viewsetId = useMemo(() => {
    let sectionId = props.view;
    if (!sectionId && props.field) {
      sectionId = Object.keys(views).find(v =>
        views[v].fields.includes(props.field!)
      );
    }
    if (!sectionId) return undefined;
    return Object.keys(viewsets).find(vs =>
      viewsets[vs].views.includes(sectionId!)
    );
  }, [props.view, props.field, views, viewsets]);

  const fieldLabelFor = (fieldId: string) =>
    (allFields[fieldId]?.['component-parameters']?.label as string) ?? fieldId;

  // Parent, linked-record and notebook metadata references selectable in
  // conditions, plus an overlay resolving each reference
  // to its underlying field definition so operator filtering
  // and value editors treat them like local fields.
  const {referenceEntries, referenceFieldDefs} = useMemo(() => {
    const entries: FieldSearchEntry[] = [];
    const defs: typeof allFields = {};
    if (!viewsetId)
      return {referenceEntries: entries, referenceFieldDefs: defs};
    const uiSpecification = {
      fields: allFields,
      views,
      viewsets,
    } as unknown as UiSpecModel;

    const {types: parentTypes} = buildParentFieldTypes({
      uiSpecification,
      formId: viewsetId,
    });
    for (const ref of parentTypes.keys()) {
      const fieldId = decodeParentRef(ref);
      if (!fieldId || !allFields[fieldId]) continue;
      defs[ref] = allFields[fieldId];
      entries.push({
        fieldId: ref,
        field: allFields[fieldId],
        label: `Parent › ${fieldLabelFor(fieldId)}`,
        id: ref,
        helperText: '',
        advancedHelperText: '',
        viewSetLabel: 'Parent record',
        sectionLabel: '',
      });
    }

    const {types: relatedTypes} = buildRelatedFieldTypes({
      uiSpecification,
      formId: viewsetId,
    });
    for (const ref of relatedTypes.keys()) {
      const parts = splitRelatedReference(ref);
      if (!parts || !allFields[parts.fieldId]) continue;
      defs[ref] = allFields[parts.fieldId];
      entries.push({
        fieldId: ref,
        field: allFields[parts.fieldId],
        label: `${fieldLabelFor(parts.relFieldId)} › ${fieldLabelFor(parts.fieldId)}`,
        id: ref,
        helperText: '',
        advancedHelperText: '',
        viewSetLabel: 'Linked record',
        sectionLabel: '',
      });
    }
    // Notebook metadata keys, referenceable as _METADATA.<key>.
    for (const key of Object.keys(custom)) {
      const ref = encodeMetadataRef(key);
      defs[ref] = metadataFieldDef(key);
      entries.push({
        fieldId: ref,
        field: defs[ref],
        label: `Notebook › ${key}`,
        id: ref,
        helperText: '',
        advancedHelperText: '',
        viewSetLabel: 'Notebook metadata',
        sectionLabel: '',
      });
    }
    return {referenceEntries: entries, referenceFieldDefs: defs};
  }, [viewsetId, allFields, views, viewsets, custom]);

  const selectableFieldCount = useMemo(
    () =>
      resolveFieldIdsInScope(allFields, views, viewsets, fieldSearchScope)
        .length,
    [allFields, views, viewsets, fieldSearchScope]
  );

  return {
    allFields: {...allFields, ...referenceFieldDefs},
    fieldSearchScope,
    referenceEntries,
    selectableFieldCount: selectableFieldCount + referenceEntries.length,
  };
};
