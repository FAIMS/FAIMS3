/**
 * FormSettingsPanel Component
 *
 * Provides configuration options for a form (viewset) including:
 * - Layout style (tabs/inline)
 * - Summary fields for record display
 * - Human-readable ID field selection
 *
 * @param {string} viewSetId - ID of the viewset being configured
 */
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  Autocomplete,
  Card,
  CardContent,
  Collapse,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import React from 'react';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {FieldType} from '../state/initial';

type ViewSetType = {
  views: string[];
  label: string;
  summary_fields?: string[];
  layout?: 'inline' | 'tabs';
  hridField?: string;
  publishButtonBehaviour?: 'always' | 'visited' | 'noErrors';
};

/**
 * Determines if a field can be used as an HRID field
 * @param field - Field configuration to check
 * @returns boolean indicating if field meets HRID requirements
 */
const isValidHridField = (field: FieldType): boolean => {
  return (
    field['type-returned'] === 'faims-core::String' &&
    (field['component-parameters'].required || false)
  );
};

/**
 * Renders section header and description with consistent styling
 */
const SettingSection = ({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) => (
  <div className="setting-section" style={{marginBottom: '2rem'}}>
    <Typography variant="subtitle1" sx={{fontWeight: 'bold', mb: 1}}>
      {title}
    </Typography>
    <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
      {description}
    </Typography>
    {children}
  </div>
);

export const FormSettingsPanel = ({viewSetId}: {viewSetId: string}) => {
  const dispatch = useAppDispatch();

  const fields = useAppSelector(
    state => state.notebook['ui-specification'].present.fields
  );
  const viewSet: ViewSetType | undefined = useAppSelector(
    state =>
      state.notebook?.['ui-specification']?.present.viewsets?.[viewSetId] ||
      undefined
  );
  const fviews = useAppSelector(
    state => state.notebook['ui-specification'].present.fviews
  );
  const [expanded, setExpanded] = React.useState(false);

  const [selectedPublishBehaviour, setSelectedPublishBehaviour] =
    React.useState('always');

  // Ensure selected value persists and is updated in the Redux store
  React.useEffect(() => {
    if (viewSet?.publishButtonBehaviour) {
      setSelectedPublishBehaviour(viewSet.publishButtonBehaviour);
    }
  }, [viewSet?.publishButtonBehaviour]);

  /**
   * Updates the Publish Button Behavior setting in Redux and persists it
   */
  const handlePublishButtonBehaviourChange = (event: any) => {
    const newValue = event.target.value;
    setSelectedPublishBehaviour(newValue);

    dispatch({
      type: 'ui-specification/viewSetPublishButtonBehaviourUpdated',
      payload: {
        viewSetId,
        publishButtonBehaviour: newValue as 'always' | 'visited' | 'noErrors',
      },
    });
  };

  /**
   * Collects all fields that belong to any view in the current viewset
   */
  const viewSetFields = React.useMemo(() => {
    const fieldSet = new Set<string>();
    viewSet.views.forEach(viewId => {
      const view = fviews[viewId];
      if (view) {
        view.fields.forEach(fieldId => fieldSet.add(fieldId));
      }
    });
    return Array.from(fieldSet);
  }, [viewSet.views, fviews]);

  /**
   * Converts field IDs to option objects for select components
   */
  const fieldOptions = viewSetFields
    .map(fieldId => {
      const field = fields[fieldId];
      return field
        ? {
            label: field['component-parameters'].label || fieldId,
            value: fieldId,
          }
        : null;
    })
    .filter((x): x is {label: string; value: string} => x !== null);

  /**
   * Filters field options to only those valid for HRID use
   */
  const hridFieldOptions = viewSetFields
    .map(fieldId => {
      const field = fields[fieldId];
      return field && isValidHridField(field)
        ? {
            label: field['component-parameters'].label || fieldId,
            value: fieldId,
          }
        : null;
    })
    .filter((x): x is {label: string; value: string} => x !== null);

  /**
   * Updates the selected summary fields
   */
  const handleSummaryFieldsChange = (
    _: any,
    newValue: Array<{label: string; value: string}>
  ) => {
    dispatch({
      type: 'ui-specification/viewSetSummaryFieldsUpdated',
      payload: {viewSetId, fields: newValue.map(v => v.value)},
    });
  };

  /**
   * Updates or clears the HRID field selection
   */
  const handleHridFieldChange = (
    _: any,
    newValue: {label: string; value: string} | null
  ) => {
    dispatch({
      type: 'ui-specification/viewSetHridUpdated',
      payload: {viewSetId, hridField: newValue?.value},
    });
  };

  const selectedFields = (viewSet.summary_fields || [])
    .map(fieldId => fieldOptions.find(opt => opt.value === fieldId))
    .filter((x): x is {label: string; value: string} => x !== null);

  const selectedHridField = viewSet.hridField
    ? hridFieldOptions.find(opt => opt.value === viewSet.hridField) || null
    : null;

  return (
    <Card sx={{width: '100%', mt: 2}}>
      <CardContent
        sx={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'action.selected',
          cursor: 'pointer',
          '&:hover': {backgroundColor: 'action.hover'},
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <SettingsIcon sx={{mr: 1, color: 'text.secondary'}} />
        <Typography variant="h6" sx={{flexGrow: 1}}>
          Form Settings
        </Typography>
        <IconButton
          sx={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
          size="small"
        >
          <ExpandMoreIcon />
        </IconButton>
      </CardContent>

      <Collapse in={expanded}>
        <CardContent>
          {/* Publish Button Behavior*/}
          <SettingSection
            title="Publish Button Behavior"
            description="Configure when the Publish and Close buttons should be shown."
          >
            <Select
              fullWidth
              value={selectedPublishBehaviour}
              onChange={handlePublishButtonBehaviourChange}
            >
              <MenuItem value="always">Always Show</MenuItem>
              <MenuItem value="visited">
                Show Once All Sections Visited
              </MenuItem>
              <MenuItem value="noErrors">
                Show Only When No Errors Exist
              </MenuItem>
            </Select>
          </SettingSection>

          {/* Layout Style section  */}
          <SettingSection
            title="Layout Style"
            description="Choose how form sections are displayed. The 'tabs' layout will display questions split up into their sections. The 'inline' layout will display all questions in a single scrollable form."
          >
            <Select
              fullWidth
              value={viewSet.layout || 'tabs'}
              onChange={event =>
                dispatch({
                  type: 'ui-specification/viewSetLayoutUpdated',
                  payload: {
                    viewSetId,
                    layout: event.target.value as 'inline' | 'tabs' | undefined,
                  },
                })
              }
            >
              <MenuItem value="tabs">Tabs</MenuItem>
              <MenuItem value="inline">Inline</MenuItem>
            </Select>
          </SettingSection>

          {/* Summary fields section */}
          <SettingSection
            title="Summary Fields"
            description="Select the field(s) you would like to display in the record list table."
          >
            <Autocomplete
              multiple
              options={fieldOptions}
              value={selectedFields}
              onChange={handleSummaryFieldsChange}
              getOptionLabel={option => option.label}
              renderInput={params => (
                <TextField
                  {...params}
                  InputProps={{
                    ...params.InputProps,
                    sx: {'& .MuiInputLabel-root': {display: 'none'}},
                  }}
                />
              )}
            />
          </SettingSection>

          {/* HRID  */}
          <SettingSection
            title="Human-Readable ID Field"
            description="A HRID is a human readable label for the record, which will be displayed in the record table. Select a required string field to use as the human-readable ID. You can use a TemplatedStringField to construct complex HRIDs."
          >
            <Autocomplete
              fullWidth
              options={hridFieldOptions}
              value={selectedHridField}
              onChange={handleHridFieldChange}
              getOptionLabel={option => option.label}
              renderInput={params => (
                <TextField
                  {...params}
                  InputProps={{
                    ...params.InputProps,
                    sx: {'& .MuiInputLabel-root': {display: 'none'}},
                  }}
                />
              )}
            />
          </SettingSection>
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default FormSettingsPanel;
