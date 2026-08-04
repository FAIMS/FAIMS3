import {
  Alert,
  ListSubheader,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import {useMemo} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {getViewsetFieldIds} from '../../features/field-search';
import {
  selectUiFields,
  selectUiViews,
  selectUiViewSets,
} from '../../store/selectors';
import {BaseFieldEditor} from './BaseFieldEditor';

type PropType = {
  fieldName: string;
  viewId: string;
  viewsetId: string;
};

// Fields with no meaningful single value to display.
const EXCLUDED_COMPONENT_NAMES = [
  'RelatedRecordSelector',
  'ParentFieldDisplay',
  'RichText',
];

type CandidateField = {
  fieldId: string;
  label: string;
  formLabel: string;
};

/**
 * Property editor for ParentFieldDisplay. Adds a select of fields drawn from
 * forms that can parent this form - those holding a Child-relation
 * RelatedRecordSelector targeting this form.
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

  const candidateFields = useMemo(() => {
    const out: CandidateField[] = [];
    for (const parentViewsetId of Object.keys(viewsets)) {
      if (parentViewsetId === viewsetId) continue;
      const ids = getViewsetFieldIds(parentViewsetId, views, viewsets);

      // A parent form holds a Child-relation selector targeting this form.
      const isParentForm = ids.some(id => {
        const f = allFields[id];
        return (
          f?.['component-name'] === 'RelatedRecordSelector' &&
          f['component-parameters']?.related_type === viewsetId &&
          f['component-parameters']?.relation_type === 'faims-core::Child'
        );
      });
      if (!isParentForm) continue;

      const formLabel = viewsets[parentViewsetId]?.label ?? parentViewsetId;
      for (const id of ids) {
        const f = allFields[id];
        if (!f) continue;
        if (EXCLUDED_COMPONENT_NAMES.includes(f['component-name'] ?? '')) {
          continue;
        }
        out.push({
          fieldId: id,
          label: (f['component-parameters']?.label as string) || id,
          formLabel,
        });
      }
    }
    return out;
  }, [viewsets, views, allFields, viewsetId]);

  const updateParentFieldId = (value: string) => {
    const newField = withUpdatedField(field, nextField => {
      nextField['component-parameters'].parentFieldId = value;
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  // Group menu items under a subheader per parent form.
  const menuItems = useMemo(() => {
    const items: React.ReactNode[] = [];
    let currentForm: string | null = null;
    for (const candidate of candidateFields) {
      if (candidate.formLabel !== currentForm) {
        currentForm = candidate.formLabel;
        items.push(
          <ListSubheader key={`form-${candidate.formLabel}`}>
            {candidate.formLabel}
          </ListSubheader>
        );
      }
      items.push(
        <MenuItem key={candidate.fieldId} value={candidate.fieldId}>
          {candidate.label}
        </MenuItem>
      );
    }
    return items;
  }, [candidateFields]);

  const selectionMissing =
    parentFieldId !== '' &&
    !candidateFields.some(c => c.fieldId === parentFieldId);

  return (
    <BaseFieldEditor fieldName={fieldName} showExtraConfig={false}>
      <Typography variant="subtitle2" sx={{mb: 1}}>
        Parent field to display
      </Typography>
      {candidateFields.length > 0 ? (
        <Select
          value={selectionMissing ? '' : parentFieldId}
          onChange={e => updateParentFieldId(e.target.value)}
          displayEmpty
          fullWidth
          size="small"
          data-testid="parent-field-select"
        >
          <MenuItem value="">
            <em>Select a field</em>
          </MenuItem>
          {menuItems}
        </Select>
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
