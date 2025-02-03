import {Edit as EditIcon} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Card,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import {MutableRefObject, useRef, useState} from 'react';
import {useAppDispatch, useAppSelector} from '../../state/hooks';
import {ComponentParameters, FieldType} from '../../state/initial';
import {MustacheTemplateBuilder} from '../TemplateBuilder';

type PropType = {
  fieldName: string;
  viewId: string;
};

/**
 * Enhanced TemplatedStringFieldEditor with visual Mustache template building support.
 * Allows users to create and edit templates using a visual builder or direct text input.
 */
export const TemplatedStringFieldEditor = ({fieldName, viewId}: PropType) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].fields[fieldName]
  );
  const allFields = useAppSelector(
    state => state.notebook['ui-specification'].fields
  );
  const dispatch = useAppDispatch();
  const textAreaRef = useRef(null) as MutableRefObject<unknown>;

  const [alertMessage, setAlertMessage] = useState('');
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const state = field['component-parameters'];

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

  // Convert fields to variables format for template builder
  const fieldVariables = Object.entries(allFields).map(([name, field]) => ({
    name,
    displayName: getFieldLabel(field),
    type: 'field' as const,
  }));

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
              <TextField
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
              <TextField
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
                <TextField
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
