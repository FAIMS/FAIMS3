import React from 'react';
import { Box, Button, Typography } from '@mui/material';
import ArchiveIcon from '@mui/icons-material/Archive';

interface ArchiveSurveyProps {
  onArchive: () => void;
}

export default function ArchiveSurvey({ onArchive }: ArchiveSurveyProps) {
  return (
    <Box
      sx={{
        marginTop: '50px',
        paddingTop: '16px',
        borderTop: '1px solid #ccc',
        textAlign: 'left',
      }}
    >
      <Typography variant="body1" gutterBottom sx={{ textAlign: 'left', fontWeight: 'bold' }}>
        Archive this survey
      </Typography>
      <Typography variant="body1" gutterBottom sx={{ textAlign: 'left' }}>
        Once archived, a survey will not be visible to any users; therefore, no data can be changed or added to the survey.
      </Typography>
      <Typography variant="body1" gutterBottom sx={{ textAlign: 'left' }}>
        To recover this survey, navigate to the main menu and click 'Settings' to go to 'Archived surveys'.
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}>
        <Button
          variant="contained"
          color="error"
          startIcon={<ArchiveIcon />}
        >
          Archive Survey
        </Button>
      </Box>
    </Box>
  );
}
