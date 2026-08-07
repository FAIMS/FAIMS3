import {Alert, Typography} from '@mui/material';
import {getFieldInfo} from '@faims3/forms';
import {useMemo} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {FieldSearchAutocomplete} from '../field-selector/FieldSearchAutocomplete';
import {getViewsetFieldIds} from '../../features/field-search';
import {
  selectUiFields,
  selectUiViews,
  selectUiViewSets,
} from '../../store/selectors';
import type {FieldType} from '../../state/initial';
import {BaseFieldEditor} from './BaseFieldEditor';

type PropType = {
  fieldName: string;
  viewId: string;
  viewsetId: string;
};

/** Whether a field type opts out of parent-value display (registry flag). */
const isExcludedFromParentDisplay = (field: FieldType): boolean => {
  const namespace = field['component-namespace'];
  const name = field['component-name'];
  if (typeof namespace !== 'string' || typeof name !== 'string') return true;
  try {
    const {fieldInfo} = getFieldInfo({namespace, name});
    return fieldInfo.excludeFromParentDisplay === true;
  } catch {
    // Unknown field type - exclude rather than offer something undisplayable.
    return true;
  }
};

/**
 * Property editor for ParentFieldDisplay. Adds a searchable field picker over
 * fields drawn from forms that can parent this form - those holding a
 * Child-relation RelatedRecordSelector targeting this form.
 */
export const ParentFieldDisplayEditor = ({fieldName, viewsetId}: PropType) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const allFields = useAppSelector(selectUiFields);
  const views = useAppSelector(selectUiViews);
  const viewsets = useAppSelector(selectUiViewSets);
  const dispatch = useAppDispatch();

  const parentFieldId =
    (field['component-parameters'].parentFieldId as string | undefined) || '';

  // Fields belonging to any form that parents this one.
  const candidateFieldIds = useMemo(() => {
    const ids = new Set<string>();
    for (const parentViewsetId of Object.keys(viewsets)) {
      if (parentViewsetId === viewsetId) continue;
      const viewsetFields = getViewsetFieldIds(
        parentViewsetId,
        views,
        viewsets
      );
      const isParentForm = viewsetFields.some(id => {
        const f = allFields[id];
        return (
          f?.['component-name'] === 'RelatedRecordSelector' &&
          f['component-parameters']?.related_type === viewsetId &&
          f['component-parameters']?.relation_type === 'faims-core::Child'
        );
      });
      if (!isParentForm) continue;
      for (const id of viewsetFields) ids.add(id);
    }
    return ids;
  }, [viewsets, views, allFields, viewsetId]);

  const updateParentFieldId = (value: string | null) => {
    const newField = withUpdatedField(field, nextField => {
      nextField['component-parameters'].parentFieldId = value ?? '';
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const selectionMissing =
    parentFieldId !== '' && !candidateFieldIds.has(parentFieldId);

  return (
    <BaseFieldEditor fieldName={fieldName} showExtraConfig={false}>
      <Typography variant="subtitle2" sx={{mb: 1}}>
        Parent field to display
      </Typography>
      {candidateFieldIds.size > 0 ? (
        <>
          <FieldSearchAutocomplete
            value={parentFieldId || null}
            onChange={updateParentFieldId}
            scope={{kind: 'all'}}
            filters={{
              predicate: (id, f) =>
                candidateFieldIds.has(id) && !isExcludedFromParentDisplay(f),
            }}
            placeholder="Search parent form fields"
            noOptionsText="No matching parent form fields"
            data-testid="parent-field-select"
            size="small"
          />
          <Typography variant="caption" sx={{display: 'block', mt: 1}}>
            If a record has more than one parent, the value shown comes from the
            first parent whose form contains this field.
          </Typography>
        </>
      ) : (
        <Alert severity="info">
          No form in this notebook has this form as a child. Add a related
          record field (with a Child relationship targeting this form) to
          another form first.
        </Alert>
      )}
      {selectionMissing && (
        <Alert severity="warning" sx={{mt: 1}}>
          The previously selected field no longer exists on a parent form.
          Choose another field.
        </Alert>
      )}
    </BaseFieldEditor>
  );
};
