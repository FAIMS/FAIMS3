import {
  Box,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material';
import {Project} from '../../../context/slices/projectSlice';
import MetadataRenderer from '../metadataRenderer';
import RangeHeader from './range_header';

interface MetadataDisplayComponentProps {
  project: Project;
  templateId?: string | null | undefined;
  handleTabChange: (index: number) => void;
}
export const MetadataDisplayComponent = (
  props: MetadataDisplayComponentProps
) => {
  /**
    Component: MetadataDisplayComponent

    */
  // TODO Destub
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 2,
          px: 2,
        }}
      >
        <Typography
          variant="body1"
          sx={{
            textAlign: 'center',
            fontSize: '18px',
            fontWeight: 'bold',
            flexGrow: 1,
          }}
        >
          Survey Details
        </Typography>
      </Box>

      <Box sx={{p: 2}}>
        <Typography variant="body1" gutterBottom sx={{marginBottom: '16px'}}>
          <strong>Name:</strong>{' '}
          <MetadataRenderer
            project_id={props.project.projectId}
            metadata_key={'name'}
            chips={false}
          />
        </Typography>
        {props.templateId && (
          <Typography variant="body1" gutterBottom sx={{marginBottom: '16px'}}>
            <strong>Template Used: </strong>
            <span>{props.templateId}</span>
          </Typography>
        )}
        <Typography
          variant="body1"
          gutterBottom
          component="div"
          sx={{marginBottom: '16px'}}
        >
          <strong>Description:</strong>{' '}
          <MetadataRenderer
            project_id={props.project.projectId}
            metadata_key={'pre_description'}
            chips={false}
          />
        </Typography>

        <Typography variant="body1" gutterBottom sx={{marginBottom: '16px'}}>
          <strong>Lead Institution:</strong>{' '}
          <MetadataRenderer
            project_id={props.project.projectId}
            metadata_key={'lead_institution'}
            chips={false}
          />
        </Typography>
        <Typography
          variant="body1"
          gutterBottom
          sx={{marginBottom: '16px', textAlign: 'left'}}
        >
          <strong>Project Lead:</strong>{' '}
          <MetadataRenderer
            project_id={props.project.projectId}
            metadata_key={'project_lead'}
            chips={false}
          />
        </Typography>
      </Box>

      <Grid container spacing={{xs: 1, sm: 2, md: 3}}>
        <Grid item xs={12} sm={6} md={6} lg={4}>
          <Box component={Paper} elevation={0} variant={'outlined'} p={2}>
            <Typography variant={'h6'} sx={{mb: 2}}>
              Description
            </Typography>
            <Typography variant="body2" color="textPrimary" gutterBottom>
              <MetadataRenderer
                project_id={props.project.projectId}
                metadata_key={'pre_description'}
                chips={false}
              />
            </Typography>
          </Box>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <TableContainer component={Paper} elevation={0} variant={'outlined'}>
            <Typography variant={'h6'} sx={{m: 2}} gutterBottom>
              About
            </Typography>
            <Table size={'small'}>
              <TableBody>
                <TableRow>
                  <TableCell>
                    <Typography variant={'overline'}>Status</Typography>
                  </TableCell>
                  <TableCell>
                    <MetadataRenderer
                      project_id={props.project.projectId}
                      metadata_key={'project_status'}
                      chips={false}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Typography variant={'overline'}>
                      Lead Institution
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <MetadataRenderer
                      project_id={props.project.projectId}
                      metadata_key={'lead_institution'}
                      chips={false}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Typography variant={'overline'}>Project Lead</Typography>
                  </TableCell>
                  <TableCell>
                    <MetadataRenderer
                      project_id={props.project.projectId}
                      metadata_key={'project_lead'}
                      chips={false}
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>
                    <Typography variant={'overline'}>Last Updated</Typography>
                  </TableCell>
                  <TableCell>
                    <MetadataRenderer
                      project_id={props.project.projectId}
                      metadata_key={'last_updated'}
                      chips={false}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
        <Grid item xs={12} sm={12} md={12} lg={4}>
          <RangeHeader
            project={props.project}
            handleAIEdit={props.handleTabChange}
          />
        </Grid>
      </Grid>
    </>
  );
};
