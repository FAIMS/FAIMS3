import './App.css';
import {useMemo, useState} from 'react';
import {PreviewFormManager} from '../lib';
import {useQueryClient} from '@tanstack/react-query';
import {
  ToggleButton,
  ToggleButtonGroup,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import ViewListIcon from '@mui/icons-material/ViewList';
import TabIcon from '@mui/icons-material/Tab';
import {
  compileUiSpecConditionals,
  decodeUiSpec,
  EncodedUISpecification,
} from '@faims3/data-model';
import {FaimsFormData} from '../lib/formModule/types';
import { getDefaultMapConfig } from '../lib/components/maps/config';

function App({uiSpec: rawUiSpec}: {uiSpec: EncodedUISpecification}) {
  const uiSpec = useMemo(() => {
    const decoded = decodeUiSpec(rawUiSpec);
    compileUiSpecConditionals(decoded);
    return decoded;
  }, [rawUiSpec]);

  const queryClient = useQueryClient();

  // Get the list of available viewsets
  const viewsetNames = useMemo(() => Object.keys(uiSpec.viewsets), [uiSpec]);

  // State for selected form (default to first viewset)
  const [selectedForm, setSelectedForm] = useState<string>(
    viewsetNames[0] ?? ''
  );

  // State to manage the layout mode
  const [layout, setLayout] = useState<'inline' | 'tabs'>('inline');

  const handleLayoutChange = (
    _event: React.MouseEvent<HTMLElement>,
    newLayout: 'inline' | 'tabs' | null
  ) => {
    if (newLayout !== null) {
      setLayout(newLayout);
    }
  };

  const handleFormChange = (event: SelectChangeEvent<string>) => {
    setSelectedForm(event.target.value);
  };

  // Mock form values for preview (form -> data map)
  const formValues: Record<string, FaimsFormData> = {
    Person: {
      'First-name': {data: 'Steve'},
      'Last-name': {data: 'Sputnik'},
      Occupation: {data: 'Developer'},
    },
    School: {},
  };

  return (
    <>
      <h1>FAIMS3 Forms</h1>
      <div className="card">
        <div
          style={{
            padding: '16px',
            border: '1px solid #ccc',
            borderRadius: '8px',
          }}
        >
          {/* Controls Row */}
          <Box
            sx={{
              mb: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              flexWrap: 'wrap',
            }}
          >
            {/* Form Selector */}
            <FormControl size="small" sx={{minWidth: 200}}>
              <InputLabel id="form-select-label">Form</InputLabel>
              <Select
                labelId="form-select-label"
                id="form-select"
                value={selectedForm}
                label="Form"
                onChange={handleFormChange}
              >
                {viewsetNames.map(name => (
                  <MenuItem key={name} value={name}>
                    {uiSpec.viewsets[name]?.label ?? name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Layout Toggle Controls */}
            <Box sx={{display: 'flex', alignItems: 'center', gap: 2}}>
              <Typography variant="body2" color="text.secondary">
                View Mode:
              </Typography>
              <ToggleButtonGroup
                value={layout}
                exclusive
                onChange={handleLayoutChange}
                aria-label="form layout"
                size="small"
              >
                <ToggleButton value="inline" aria-label="inline list">
                  <ViewListIcon sx={{mr: 1, fontSize: 20}} />
                  Inline
                </ToggleButton>
                <ToggleButton value="tabs" aria-label="tabs">
                  <TabIcon sx={{mr: 1, fontSize: 20}} />
                  Tabs
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          {/* Form Manager with dynamic layout and form props */}
          {selectedForm && (
            <PreviewFormManager
              key={selectedForm}
              mapConfig={getDefaultMapConfig}
              initialFormData={formValues[selectedForm] ?? {}}
              layout={layout}
              formName={selectedForm}
              uiSpec={uiSpec}
              queryClient={queryClient}
            />
          )}
        </div>
      </div>
    </>
  );
}

export default App;
