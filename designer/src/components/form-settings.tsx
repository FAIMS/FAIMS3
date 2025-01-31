import React from 'react';
import { Card, CardContent, Typography, Select, MenuItem, FormControl, InputLabel, Autocomplete, TextField, IconButton, Collapse } from '@mui/material';
import { useAppDispatch, useAppSelector } from '../state/hooks';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsIcon from '@mui/icons-material/Settings';

type FormSettingsPanelProps = {
  viewSetId: string;
};

export const FormSettingsPanel = ({ viewSetId }: FormSettingsPanelProps) => {
  const dispatch = useAppDispatch();
  const fields = useAppSelector(state => state.notebook['ui-specification'].fields);
  const viewSet = useAppSelector(state => state.notebook['ui-specification'].viewsets[viewSetId]);
  const fviews = useAppSelector(state => state.notebook['ui-specification'].fviews);
  const [expanded, setExpanded] = React.useState(false);

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

  const fieldOptions = viewSetFields
    .map(fieldId => {
      const field = fields[fieldId];
      return field ? {
        label: field['component-parameters'].label || fieldId,
        value: fieldId
      } : null;
    })
    .filter((x): x is { label: string, value: string } => x !== null);

  const handleLayoutChange = (event: any) => {
    dispatch({
      type: 'ui-specification/viewSetLayoutUpdated',
      payload: { 
        viewSetId, 
        layout: event.target.value as 'inline' | 'tabs' | undefined 
      }
    });
  };

  const handleSummaryFieldsChange = (_: any, newValue: Array<{ label: string, value: string }>) => {
    dispatch({
      type: 'ui-specification/viewSetSummaryFieldsUpdated',
      payload: { 
        viewSetId, 
        fields: newValue.map(v => v.value)
      }
    });
  };

  const selectedFields = (viewSet.summary_fields || [])
    .map(fieldId => fieldOptions.find(opt => opt.value === fieldId))
    .filter((x): x is { label: string, value: string } => x !== null);

  return (
    <Card sx={{ 
      width: '100%',
      mt: 2,
    }}>
      <CardContent 
        sx={{ 
          display: 'flex',
          alignItems: 'center',
          px: 3,
          py: 2,
          backgroundColor: 'action.selected',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: 'action.hover'
          }
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <SettingsIcon sx={{ mr: 1, color: 'text.secondary' }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>Form Settings</Typography>
        <IconButton
          sx={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s'
          }}
          size="small"
        >
          <ExpandMoreIcon />
        </IconButton>
      </CardContent>

      <Collapse in={expanded}>
        <CardContent sx={{ p: 3 }}>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Configure form layout and display options
          </Typography>

          <FormControl fullWidth sx={{ mb: 4 }}>
            <InputLabel>Layout Style</InputLabel>
            <Select
              value={viewSet.layout || 'tabs'}
              label="Layout Style"
              onChange={handleLayoutChange}
            >
              <MenuItem value="tabs">Tabs</MenuItem>
              <MenuItem value="inline">Inline</MenuItem>
            </Select>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Choose how form sections are displayed
            </Typography>
          </FormControl>

          <FormControl fullWidth>
            <Autocomplete
              multiple
              options={fieldOptions}
              value={selectedFields}
              onChange={handleSummaryFieldsChange}
              getOptionLabel={(option) => option.label}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Summary Fields"
                  placeholder="Select fields"
                />
              )}
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Select fields to display in record summaries
            </Typography>
          </FormControl>
        </CardContent>
      </Collapse>
    </Card>
  );
};

export default FormSettingsPanel;