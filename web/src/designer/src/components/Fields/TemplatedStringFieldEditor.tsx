import {Edit as EditIcon} from '@mui/icons-material';
import {Alert, Box, Button, Card, Grid, Typography} from '@mui/material';
import {MutableRefObject, useMemo, useRef, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {ComponentParameters, FieldType} from '../../state/initial';
import {MustacheTemplateBuilder} from '../TemplateBuilder';
import DebouncedTextField from '../debounced-text-field';

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
    state => state.notebook['ui-specification'].present.fields[fieldName]
  );
  const allFields = useAppSelector(
    state => state.notebook['ui-specification'].present.fields
  );
  const dispatch = useAppDispatch();
  const textAreaRef = useRef(null) as MutableRefObject<unknown>;

  const [alertMessage, setAlertMessage] = useState('');
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const state = field['component-parameters'];

  const viewSet = useAppSelector(
    state => state.notebook['ui-specification'].present.viewsets[viewsetId]
  );
  const fviews = useAppSelector(
    state => state.notebook['ui-specification'].present.fviews
  );

  /**
   * Collects all fields that belong to any view in the current viewset
   */
  const viewSetFields = useMemo(() => {
    const fieldSet = new Set<string>();
    viewSet.views.forEach(viewId => {
      const view = fviews[viewId];
      if (view) {
        view.fields.forEach(fieldId => fieldSet.add(fieldId));
      }
    });
    return Array.from(fieldSet);
  }, [viewSet.views, fviews]);

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
    return (
      f['component-parameters'].InputLabelProps?.label ||
      f['component-parameters'].name ||
      ''
    );
  };

  const fieldVariables = viewSetFields.map(name => {
    const fieldDetails = allFields[name];
    return {
      name,
      displayName: getFieldLabel(fieldDetails),
      type: 'field' as const,
    };
  });

  const updateFieldFromState = (newState: ComponentParameters) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType;
    newField['component-parameters'].InputLabelProps = {
      label: newState.label || fieldName,
    };
    newField['component-parameters'].helperText = newState.helperText;
    newField['component-parameters'].template = newState.template;
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: {fieldName, newField},
    });
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
        <Grid item xs={12}>
          <Alert onClose={() => setAlertMessage('')} severity="error">
            {alertMessage}
          </Alert>
        </Grid>
      )}

      <Grid item xs={12}>
        <Card variant="outlined">
          <Grid container spacing={2} sx={{p: 2}}>
            <Grid item sm={6} xs={12}>
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
            <Grid item sm={6} xs={12}>
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

      <Grid item xs={12}>
        <Card variant="outlined">
          <Box sx={{p: 2}}>
            <Typography variant="subtitle2" sx={{mb: 2}}>
              Template
            </Typography>

            <Grid container spacing={2}>
              <Grid item xs>
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
              <Grid item>
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
        variables={fieldVariables}
        systemVariables={systemVariables}
        onSave={handleTemplateChange}
      />
    </Grid>
  );
};
