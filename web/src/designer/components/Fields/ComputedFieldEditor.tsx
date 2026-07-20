import {Box, Chip, FormHelperText, Typography} from '@mui/material';
import {useMemo} from 'react';
import {FAIMS_TYPE_TO_EXPR_TYPE} from '@faims3/data-model';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {withUpdatedField} from '../../features/fields/shared/updateField';
import {fieldUpdated} from '../../store/slices/uiSpec';
import DebouncedTextField from '../debounced-text-field';
import {BaseFieldEditor} from './BaseFieldEditor';

type PropType = {
  fieldName: string;
  viewId: string;
  viewsetId: string;
};

// Component names whose values are derived and so cannot feed an expression.
const DERIVED_COMPONENT_NAMES = [
  'ComputedNumber',
  'ComputedText',
  'TemplatedStringField',
];

// True if the field can be referenced from an expression: its type maps onto
// an expression value type and it is not itself derived.
const isReferenceableField = (field: {
  'type-returned'?: string;
  'component-name'?: string;
}) =>
  FAIMS_TYPE_TO_EXPR_TYPE[field['type-returned'] ?? ''] !== undefined &&
  !DERIVED_COMPONENT_NAMES.includes(field['component-name'] ?? '');

/**
 * Property editor shared by ComputedNumber and ComputedText. Uses
 * BaseFieldEditor for the standard field settings and adds the typed
 * expression below. Field references are wrapped in braces, e.g.
 * {Width} * {Height}; the chips insert a reference for each referenceable
 * field in the form.
 */
export const ComputedFieldEditor = ({fieldName, viewsetId}: PropType) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const allFields = useAppSelector(
    state => state.notebook.uiSpec.present.fields
  );
  const viewSet = useAppSelector(
    state => state.notebook.uiSpec.present.viewsets[viewsetId]
  );
  const views = useAppSelector(state => state.notebook.uiSpec.present.views);
  const dispatch = useAppDispatch();

  const expression =
    (field['component-parameters'].expression as string | undefined) || '';
  const isText = field['component-name'] === 'ComputedText';

  // Referenceable field ids in this form, excluding this field itself.
  const referenceableFieldIds = useMemo(() => {
    const ids: string[] = [];
    const seen = new Set<string>();
    viewSet?.views.forEach(viewId => {
      views[viewId]?.fields.forEach(id => {
        if (id === fieldName || seen.has(id)) return;
        seen.add(id);
        if (isReferenceableField(allFields[id] ?? {})) {
          ids.push(id);
        }
      });
    });
    return ids;
  }, [viewSet?.views, views, allFields, fieldName]);

  const updateExpression = (value: string) => {
    const newField = withUpdatedField(field, nextField => {
      nextField['component-parameters'].expression = value;
    });
    dispatch(fieldUpdated({fieldName, newField}));
  };

  // Appends a braced field reference to the expression, space-separated.
  const insertFieldRef = (id: string) => {
    const ref = `{${id}}`;
    updateExpression(expression === '' ? ref : `${expression} ${ref}`);
  };

  return (
    <BaseFieldEditor fieldName={fieldName}>
      <Box sx={{mb: 1}}>
        <Typography variant="subtitle2" sx={{mb: 1}}>
          Expression
        </Typography>
        <DebouncedTextField
          name="expression"
          variant="outlined"
          fullWidth
          multiline
          rows={3}
          value={expression}
          onChange={e => updateExpression(e.target.value)}
          helperText={
            isText
              ? "Text expression over other fields, e.g. {Site-Code} & '-' & {Plot}"
              : 'Numeric expression over other fields, e.g. {Width} * {Height}'
          }
        />
        {referenceableFieldIds.length > 0 && (
          <Box sx={{mt: 2}}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{display: 'block', mb: 1}}
            >
              Insert a field:
            </Typography>
            <Box sx={{display: 'flex', flexWrap: 'wrap', gap: 1}}>
              {referenceableFieldIds.map(id => {
                const label =
                  (
                    allFields[id]?.['component-parameters'] as
                      | {label?: string}
                      | undefined
                  )?.label || id;
                return (
                  <Chip
                    key={id}
                    label={label === id ? id : `${label} (${id})`}
                    size="small"
                    variant="outlined"
                    onClick={() => insertFieldRef(id)}
                  />
                );
              })}
            </Box>
          </Box>
        )}
        <FormHelperText>
          Reference other fields by wrapping their ID in braces. Click a field
          above to insert it.
        </FormHelperText>
      </Box>
    </BaseFieldEditor>
  );
};
