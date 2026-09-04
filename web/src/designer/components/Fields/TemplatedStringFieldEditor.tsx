import {Edit as EditIcon} from '@mui/icons-material';
import {Alert, Box, Button, Card, Grid, Typography} from '@mui/material';
import {MutableRefObject, useMemo, useRef, useState} from 'react';
import {TemplatedStringProps} from '@faims3/forms';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {FieldType} from '../../state/initial';
import {MustacheTemplateBuilder} from '../TemplateBuilder';
import DebouncedTextField from '../debounced-text-field';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {selectCustomMetadata} from '../../store/selectors';
import {
  buildParentFieldTypes,
  buildRelatedFieldTypes,
  encodeMetadataRef,
  isReferenceableMetadataKey,
  PARENT_REFERENCE_PREFIX,
  UiSpecModel,
} from '@faims3/data-model';

type PropType = {
  fieldName: string;
  viewId: string;
  viewsetId: string;
};

/**
 * Enhanced TemplatedStringFieldEditor with visual Mustache template building support.
 * Allows users to create and edit templates using a visual builder or direct text input.
 */
export const TemplatedStringFieldEditor = ({
  fieldName,
  viewsetId,
}: PropType) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const allFields = useAppSelector(
    state => state.notebook.uiSpec.present.fields
  );
  const custom = useAppSelector(selectCustomMetadata);
  const dispatch = useAppDispatch();
  const textAreaRef = useRef(null) as MutableRefObject<unknown>;

  const [alertMessage, setAlertMessage] = useState('');
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const state = field['component-parameters'] as TemplatedStringProps;

  const viewSet = useAppSelector(
    state => state.notebook.uiSpec.present.viewsets[viewsetId]
  );
  const views = useAppSelector(state => state.notebook.uiSpec.present.views);
  const viewsets = useAppSelector(
    state => state.notebook.uiSpec.present.viewsets
  );

  /**
   * Collects all fields that belong to any view in the current viewset
   */
  const viewSetFields = useMemo(() => {
    const fieldSet = new Set<string>();
    viewSet.views.forEach(viewId => {
      const view = views[viewId];
      if (view) {
        view.fields.forEach(fieldId => fieldSet.add(fieldId));
      }
    });
    return Array.from(fieldSet);
  }, [viewSet.views, views]);

  // Define system variables
  const systemVariables = [
    {
      name: '_CREATOR_NAME',
      displayName: 'Creator Name',
      type: 'system' as const,
    },
    {
      name: '_CREATED_TIME',
      displayName: 'Created Time',
      type: 'system' as const,
    },
  ];

  const getFieldLabel = (f: FieldType) => {
    const params = f['component-parameters'] as TemplatedStringProps;
    return params.label || params.InputLabelProps?.label || params.name || '';
  };

  const fieldVariables = viewSetFields.map(name => {
    const fieldDetails = allFields[name];
    return {
      name,
      displayName: getFieldLabel(fieldDetails),
      type: 'field' as const,
    };
  });

  // Parent fields usable as {{_PARENT.Field-ID}}.
  const parentVariables = useMemo(() => {
    const {types} = buildParentFieldTypes({
      uiSpecification: {
        fields: allFields,
        views,
        viewsets,
      } as unknown as UiSpecModel,
      formId: viewsetId,
    });
    return [...types.keys()].map(ref => {
      const id = ref.slice(PARENT_REFERENCE_PREFIX.length);
      return {
        name: ref,
        displayName: `Parent: ${getFieldLabel(allFields[id]) || id}`,
        type: 'field' as const,
      };
    });
  }, [allFields, views, viewsets, viewsetId]);

  // Notebook metadata usable as {{_METADATA.key}}.
  const metadataVariables = useMemo(
    () =>
      Object.keys(custom)
        .filter(isReferenceableMetadataKey)
        .map(key => ({
          name: encodeMetadataRef(key),
          displayName: `Notebook: ${key}`,
          type: 'field' as const,
        })),
    [custom]
  );

  // Fields on linked records usable as {{Rel-Field-ID.Field-ID}}.
  const relatedVariables = useMemo(() => {
    const {types} = buildRelatedFieldTypes({
      uiSpecification: {
        fields: allFields,
        views,
        viewsets,
      } as unknown as UiSpecModel,
      formId: viewsetId,
    });
    return [...types.keys()].map(ref => {
      const dot = ref.indexOf('.');
      const relFieldId = ref.slice(0, dot);
      const id = ref.slice(dot + 1);
      const relLabel = getFieldLabel(allFields[relFieldId]) || relFieldId;
      const label = getFieldLabel(allFields[id]) || id;
      return {
        name: ref,
        displayName: `${relLabel} > ${label}`,
        type: 'field' as const,
      };
    });
  }, [allFields, views, viewsets, viewsetId]);

  const updateFieldFromState = (newState: TemplatedStringProps) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    const newParams = newField['component-parameters'] as TemplatedStringProps;
    // label is the canonical property the rest of the designer reads;
    // mirror to InputLabelProps.label for older consumers.
    newParams.label = newState.label || fieldName;
    newParams.InputLabelProps = {
      label: newState.label || fieldName,
    };
    newParams.helperText = newState.helperText;
    newParams.template = newState.template;
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const updateProperty = (prop: string, value: string | boolean) => {
    const newState = {...state, [prop]: value};
    updateFieldFromState(newState);
  };

  const handleTemplateChange = (template: string) => {
    updateProperty('template', template);
  };

  return (
    <Grid container spacing={2}>
      {alertMessage && (
        <Grid size={12}>
          <Alert onClose={() => setAlertMessage('')} severity="error">
            {alertMessage}
          </Alert>
        </Grid>
      )}

      <Grid size={12}>
        <Card variant="outlined">
          <Grid container spacing={2} sx={{p: 2}}>
            <Grid size={{xs: 12, sm: 6}}>
              <DebouncedTextField
                name="label"
                variant="outlined"
                label="Label"
                fullWidth
                value={state.label || ''}
                onChange={e => updateProperty('label', e.target.value)}
                helperText="Enter a label for the field"
              />
            </Grid>
            <Grid size={{xs: 12, sm: 6}}>
              <DebouncedTextField
                name="helperText"
                variant="outlined"
                label="Helper Text"
                fullWidth
                multiline
                rows={4}
                value={state.helperText || ''}
                helperText="Help text shown along with the field"
                onChange={e => updateProperty('helperText', e.target.value)}
              />
            </Grid>
          </Grid>
        </Card>
      </Grid>

      <Grid size={12}>
        <Card variant="outlined">
          <Box sx={{p: 2}}>
            <Typography variant="subtitle2" sx={{mb: 2}}>
              Template
            </Typography>

            <Grid container spacing={2}>
              <Grid size="grow">
                <DebouncedTextField
                  name="template"
                  inputRef={textAreaRef}
                  variant="outlined"
                  fullWidth
                  multiline
                  rows={4}
                  value={state.template || ''}
                  onChange={e => updateProperty('template', e.target.value)}
                  helperText="Enter the template or use the visual builder"
                />
              </Grid>
              <Grid size="auto">
                <Button
                  variant="outlined"
                  startIcon={<EditIcon />}
                  onClick={() => setIsBuilderOpen(true)}
                  sx={{height: '56px'}}
                >
                  Visual Builder
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Card>
      </Grid>

      <MustacheTemplateBuilder
        open={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        initialTemplate={state.template}
        variables={[
          ...fieldVariables,
          ...parentVariables,
          ...relatedVariables,
          ...metadataVariables,
        ]}
        systemVariables={systemVariables}
        onSave={handleTemplateChange}
      />
    </Grid>
  );
};
