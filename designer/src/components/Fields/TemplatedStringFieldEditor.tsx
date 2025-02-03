import {
  Alert,
  Card,
  FormControl,
  FormControlLabel,
  Checkbox,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Divider,
} from '@mui/material';
import { MutableRefObject, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../state/hooks';
import { ComponentParameters, FieldType } from '../../state/initial';

/**
 * Mapping of system variables to their display names.
 * These variables are injected at runtime and are prefixed with an underscore
 * to distinguish them from regular field references.
 */
const SYSTEM_VARIABLES: Array<{ display: string; template: string }> = [
  { display: 'Creator Name', template: '_CREATOR_NAME' },
  { display: 'Created Time', template: '_CREATED_TIME' },
];

/**
 * Props for the TemplatedStringFieldEditor component
 */
type PropType = {
  /** The name/identifier of the field being edited */
  fieldName: string;
  /** The ID of the current view */
  viewId: string;
};

/**
 * A component for editing templated string fields with support for field references
 * and system variables.
 * 
 * Features:
 * - Field label and helper text configuration
 * - Template content with field references using {{field-id}} syntax
 * - System variable insertion using predefined variables (e.g. {{_CREATOR_NAME}})
 * - Field visibility toggle
 * 
 * System variables are distinguished from field references by:
 * - Starting with an underscore
 * - Using all caps
 * - Having predefined values that are injected at runtime
 */
export const TemplatedStringFieldEditor = ({ fieldName, viewId }: PropType) => {
  const field = useAppSelector(
    state => state.notebook['ui-specification'].fields[fieldName]
  );
  const allFields = useAppSelector(
    state => state.notebook['ui-specification'].fields
  );
  const dispatch = useAppDispatch();
  const textAreaRef = useRef(null) as MutableRefObject<unknown>;

  const [alertMessage, setAlertMessage] = useState('');
  const [insertType, setInsertType] = useState<'field' | 'system'>('field');

  const state = field['component-parameters'];

  /**
   * Gets the display label for a field, falling back to the field name if no label is set
   */
  const getFieldLabel = (f: FieldType) => {
    return (
      (f['component-parameters'].InputLabelProps?.label) ||
      f['component-parameters'].name ||
      ''
    );
  };

  /**
   * Updates the field in the store with new component parameters
   */
  const updateFieldFromState = (newState: ComponentParameters) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
    newField['component-parameters'].InputLabelProps = {
      label: newState.label || fieldName,
    };
    newField['component-parameters'].helperText = newState.helperText;
    newField['component-parameters'].template = newState.template;
    newField['component-parameters'].ElementProps = {
      ...newField['component-parameters'].ElementProps,
      hidden: newState.ElementProps?.hidden,
    };
    dispatch({
      type: 'ui-specification/fieldUpdated',
      payload: { fieldName, newField },
    });
  };

  /**
   * Updates a single property in the component state
   */
  const updateProperty = (prop: string, value: string | boolean) => {
    if (prop === 'hidden') {
      const newState = {
        ...state,
        ElementProps: {
          ...state.ElementProps,
          hidden: value as boolean,
        },
      };
      updateFieldFromState(newState);
    } else {
      const newState = { ...state, [prop]: value };
      updateFieldFromState(newState);
    }
  };

  /**
   * Inserts a reference (field or system variable) at the current cursor position
   * @param reference - For fields, this is the field ID. For system variables, this is the template name
   * @param type - Whether this is a field reference or system variable
   */
  const insertReference = (reference: string, type: 'field' | 'system') => {
    if (textAreaRef.current) {
      const el = textAreaRef.current as HTMLTextAreaElement;
      el.focus();
      const [start, end] = [el.selectionStart, el.selectionEnd];
      el.setRangeText(`{{${reference}}}`, start, end, 'select');
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  return (
    <Grid container spacing={2}>
      {alertMessage && (
        <Grid item xs={12}>
          <Alert
            onClose={() => setAlertMessage('')}
            severity="error"
          >
            {alertMessage}
          </Alert>
        </Grid>
      )}

      <Grid item xs={12}>
        <Card variant="outlined">
          <Grid container spacing={2} sx={{ p: 2 }}>
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
        <Typography variant="body2" sx={{ mb: 2 }}>
          The template can contain text, field references (e.g. {'{{field-id}}'}), 
          and system variables (e.g. {'{{_CREATED_TIME}}'}).
          Use the selectors below to insert references.
        </Typography>
        
        <Card variant="outlined">
          <Grid container spacing={2} sx={{ p: 2 }}>
            <Grid item xs={12}>
              <TextField
                name="template"
                inputRef={(ref: MutableRefObject<HTMLElement>) =>
                  (textAreaRef.current = ref)
                }
                variant="outlined"
                fullWidth
                multiline
                rows={4}
                label="Template"
                value={state.template || ''}
                onChange={e => updateProperty('template', e.target.value)}
                helperText="Enter the template text with optional references"
              />
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="reference-type-label">Reference Type</InputLabel>
                <Select
                  labelId="reference-type-label"
                  label="Reference Type"
                  value={insertType}
                  onChange={e => setInsertType(e.target.value as 'field' | 'system')}
                >
                  <MenuItem value="field">Field Reference</MenuItem>
                  <MenuItem value="system">System Variable</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              {insertType === 'field' ? (
                <FormControl fullWidth>
                  <InputLabel id="field-insert-label">
                    Insert Field Reference
                  </InputLabel>
                  <Select
                    labelId="field-insert-label"
                    label="Insert Field Reference"
                    onChange={e => insertReference(e.target.value, 'field')}
                    value=""
                  >
                    {Object.keys(allFields).map(fieldId => (
                      <MenuItem key={fieldId} value={fieldId}>
                        {getFieldLabel(allFields[fieldId])}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                <FormControl fullWidth>
                  <InputLabel id="system-var-label">
                    Insert System Variable
                  </InputLabel>
                  <Select
                    labelId="system-var-label"
                    label="Insert System Variable"
                    onChange={e => insertReference(e.target.value, 'system')}
                    value=""
                  >
                    {SYSTEM_VARIABLES.map(({ display, template }) => (
                      <MenuItem key={template} value={template}>
                        {display}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={state.ElementProps?.hidden || false}
                    onChange={e => updateProperty('hidden', e.target.checked)}
                  />
                }
                label="Hide this field"
              />
            </Grid>
          </Grid>
        </Card>
      </Grid>
    </Grid>
  );
};