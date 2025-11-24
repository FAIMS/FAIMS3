import './App.css';
import {useState} from 'react';
import {PreviewFormManager} from '../lib';
import {useQueryClient} from '@tanstack/react-query';
import {ToggleButton, ToggleButtonGroup, Box, Typography} from '@mui/material';
import ViewListIcon from '@mui/icons-material/ViewList';
import TabIcon from '@mui/icons-material/Tab';

function App(props: {project: any}) {
  const uiSpec = props.project['ui-specification'];
  const queryClient = useQueryClient();

  // Existing logic from your snippet
  uiSpec.views = uiSpec.fviews;

  // State to manage the layout mode
  const [layout, setLayout] = useState<'inline' | 'tabs'>('inline');

  const handleLayoutChange = (
    event: React.MouseEvent<HTMLElement>,
    newLayout: 'inline' | 'tabs' | null
  ) => {
    // Prevent deselecting the current option (keep one active at all times)
    if (newLayout !== null) {
      setLayout(newLayout);
    }
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
          {/* Layout Toggle Controls */}
          <Box sx={{mb: 2, display: 'flex', alignItems: 'center', gap: 2}}>
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

          {/* Form Manager with dynamic layout prop */}
          <PreviewFormManager
            layout={layout}
            formName="Person"
            uiSpec={uiSpec}
            queryClient={queryClient}
          />
        </div>
      </div>
    </>
  );
}

export default App;
