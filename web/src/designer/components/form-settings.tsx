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
import InfoIcon from '@mui/icons-material/Info';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  Autocomplete,
  Box,
  Card,
  CardContent,
  Collapse,
  IconButton,
  MenuItem,
  Select,
  Tooltip,
  Typography,
} from '@mui/material';
import React from 'react';
import {NOTEBOOK_NAME} from '@/constants';
import {useAppDispatch, useAppSelector} from '../state/hooks';
import {FieldType} from '../state/initial';
import {designerInfoIconSx} from './designer-style';
import {
  viewSetDisplayInOverviewMapUpdated,
  viewSetHridUpdated,
  viewSetLayoutUpdated,
  viewSetSummaryFieldsUpdated,
} from '../store/slices/uiSpec';
import DebouncedTextField from './debounced-text-field';

type ViewSetType = {
  views: string[];
  label: string;
  summary_fields?: string[];
  layout?: 'inline' | 'tabs';
  hridField?: string;
  displayInOverviewMap?: boolean;
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
  tooltipText,
  children,
}: {
  title: string;
  description: string;
  tooltipText?: string;
  children: React.ReactNode;
}) => (
  <div className="setting-section" style={{marginBottom: '2rem'}}>
    <Box sx={{display: 'flex', alignItems: 'center', gap: 1, mb: 1}}>
      <Typography variant="subtitle1" sx={{fontWeight: 'bold'}}>
        {title}
      </Typography>
      {tooltipText ? (
        <Tooltip title={tooltipText}>
          <InfoIcon
            sx={{
              ...(designerInfoIconSx as Record<string, unknown>),
            }}
          />
        </Tooltip>
      ) : null}
    </Box>
    <Typography variant="body2" color="text.secondary" sx={{mb: 2}}>
      {description}
    </Typography>
    {children}
  </div>
);

export const FormSettingsContent = ({viewSetId}: {viewSetId: string}) => {
  const dispatch = useAppDispatch();

  const fields = useAppSelector(state => state.notebook.uiSpec.present.fields);
  const viewSet: ViewSetType | undefined = useAppSelector(
    state => state.notebook?.uiSpec?.present.viewsets?.[viewSetId] || undefined
  );
  const views = useAppSelector(state => state.notebook.uiSpec.present.views);

  /**
   * Collects all fields that belong to any view in the current viewset
   */
  const viewSetFields = React.useMemo(() => {
    const fieldSet = new Set<string>();
    viewSet.views.forEach(viewId => {
      const view = views[viewId];
      if (view) {
        view.fields.forEach(fieldId => fieldSet.add(fieldId));
      }
    });
    return Array.from(fieldSet);
  }, [viewSet.views, views]);

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
    _event: React.SyntheticEvent,
    newValue: Array<{label: string; value: string}>
  ) => {
    dispatch(
      viewSetSummaryFieldsUpdated({
        viewSetId,
        fields: newValue.map(v => v.value),
      })
    );
  };

  /**
   * Updates or clears the HRID field selection
   */
  const handleHridFieldChange = (
    _event: React.SyntheticEvent,
    newValue: {label: string; value: string} | null
  ) => {
    dispatch(viewSetHridUpdated({viewSetId, hridField: newValue?.value}));
  };

  const selectedFields = (viewSet.summary_fields || [])
    .map(fieldId => fieldOptions.find(opt => opt.value === fieldId))
    .filter((x): x is {label: string; value: string} => {
      const isValid = x !== null && x !== undefined;
      if (!isValid) {
        console.warn(
          'Found null/undefined field while attempting to render summary fields!'
        );
      }
      return isValid;
    });

  const selectedHridField = viewSet.hridField
    ? hridFieldOptions.find(opt => opt.value === viewSet.hridField) || null
    : null;

  return (
    <>
      {/* Layout Style section  */}
      <SettingSection
        title="Layout Style"
        description="Choose how form sections are displayed. The 'tabs' layout will display questions split up into their sections. The 'inline' layout will display all questions in a single scrollable form."
        tooltipText="Tabs splits the form into one tab per section, so users move through sections step by step — best for long, multi-section forms. Inline shows every section's questions together on one scrollable page — best for short forms."
      >
        <Select
          fullWidth
          value={viewSet.layout || 'tabs'}
          onChange={event =>
            dispatch(
              viewSetLayoutUpdated({
                viewSetId,
                layout: event.target.value as 'inline' | 'tabs' | undefined,
              })
            )
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
        tooltipText="These fields' values appear as columns when records are listed in a table. Pick the fields that best identify a record at a glance, such as a name or site code. Leave empty to use the default record display."
      >
        <Autocomplete
          multiple
          options={fieldOptions}
          value={selectedFields}
          onChange={handleSummaryFieldsChange}
          getOptionLabel={option => option.label}
          renderInput={params => (
            <DebouncedTextField {...params} onChange={() => {}} />
          )}
        />
      </SettingSection>

      {/* HRID  */}
      <SettingSection
        title="Human-Readable ID Field"
        description="A HRID is a human readable label for the record, which will be displayed in the record table. Select a required string field to use as the human-readable ID. You can use a TemplatedStringField to construct complex HRIDs."
        tooltipText="The Human-Readable ID labels each record in lists and exports. It must be a required string field. For composite IDs (e.g. site code + date), build a Templated String field and select it here."
      >
        <Autocomplete
          fullWidth
          options={hridFieldOptions}
          value={selectedHridField}
          onChange={handleHridFieldChange}
          getOptionLabel={option => option.label}
          renderInput={params => (
            <DebouncedTextField {...params} onChange={() => {}} />
          )}
        />
      </SettingSection>

      {/* Overview map visibility */}
      <SettingSection
        title="Overview Map"
        description={`Choose whether to show spatial features from this form in the ${NOTEBOOK_NAME} overview map e.g. points, lines, polygons.`}
      >
        <Select
          fullWidth
          value={viewSet.displayInOverviewMap !== false ? 'show' : 'hide'}
          onChange={event =>
            dispatch(
              viewSetDisplayInOverviewMapUpdated({
                viewSetId,
                displayInOverviewMap: event.target.value === 'show',
              })
            )
          }
        >
          <MenuItem value="show">Show spatial features</MenuItem>
          <MenuItem value="hide">Don&apos;t show spatial features</MenuItem>
        </Select>
      </SettingSection>
    </>
  );
};

export const FormSettingsPanel = ({viewSetId}: {viewSetId: string}) => {
  const [expanded, setExpanded] = React.useState(false);

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
          <FormSettingsContent viewSetId={viewSetId} />
        </CardContent>
      </Collapse>
    </Card>
  );
};

/** Default export of {@link FormSettingsPanel}. */
export default FormSettingsPanel;
