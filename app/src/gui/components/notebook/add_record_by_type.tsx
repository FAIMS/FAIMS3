import {
  getRecordsWithRegex,
  ProjectUIModel,
  RecordMetadata,
} from '@faims3/data-model';
import AddIcon from '@mui/icons-material/Add';
import {Box, Button, ButtonGroup, CircularProgress} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useEffect, useState} from 'react';
import {Navigate, Link as RouterLink} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {getMetadataValue} from '../../../sync/metadata';
import {ProjectExtended} from '../../../types/project';
import {getUiSpecForProject} from '../../../uiSpecification';
import {QRCodeButton} from '../../fields/qrcode/QRCodeFormField';

type AddRecordButtonsProps = {
  project: ProjectExtended;
  recordLabel: string;
};

export default function AddRecordButtons({
  project: {_id, project_id},
  recordLabel,
}: AddRecordButtonsProps) {
  const theme = useTheme();
  const mq_above_md = useMediaQuery(theme.breakpoints.up('md'));
  const mq_above_sm = useMediaQuery(theme.breakpoints.up('sm'));
  const [uiSpec, setUiSpec] = useState<ProjectUIModel | undefined>(undefined);
  const [showQRButton, setShowQRButton] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<
    RecordMetadata | undefined
  >(undefined);

  getMetadataValue(project_id, 'showQRCodeButton').then(value => {
    setShowQRButton(value === true || value === 'true');
  });

  useEffect(() => {
    getUiSpecForProject(project_id).then(u => setUiSpec(u));
  }, [project_id]);

  const buttonLabel = `Add new ${recordLabel}`;

  if (uiSpec === undefined) {
    return <CircularProgress thickness={2} size={12} />;
  }
  const viewsets = uiSpec.viewsets;
  const visible_types = uiSpec.visible_types;

  const handleScanResult = (value: string) => {
    // find a record with this field value
    getRecordsWithRegex(_id, value, true).then(records => {
      // navigate to it
      // what should happen if there are more than one?
      for (const key in records) {
        setSelectedRecord(records[key]);
      }
    });
  };
  if (selectedRecord) {
    /*  if we have selected a record (via QR scanning) then redirect to it here */
    return (
      <Navigate
        to={ROUTES.getRecordRoute(
          project_id || 'dummy',
          (selectedRecord.record_id || '').toString(),
          (selectedRecord.revision_id || '').toString()
        )}
      />
    );
  } else {
    return (
      <Box>
        <ButtonGroup
          fullWidth={mq_above_md ? false : true}
          orientation={mq_above_sm ? 'horizontal' : 'vertical'}
          sx={{
            maxHeight: '400px',
            justifyContent: mq_above_sm ? 'flex-start' : 'center',
          }}
        >
          {/*If the list of views hasn't loaded yet*/}
          {/*we can still show this button, except it will*/}
          {/*redirect to the Record creation without known type*/}
          {uiSpec?.visible_types.length === 1 ? (
            <Button
              variant="outlined"
              color="primary"
              component={RouterLink}
              key="newRecord"
              to={
                ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                project_id +
                ROUTES.RECORD_CREATE +
                visible_types
              }
              sx={{
                fontWeight: 'bold',
                backgroundColor: theme.palette.icon.main,
                color: '#FFFFFF',

                '&:hover': {
                  backgroundColor: theme.palette.secondary.dark,
                },
              }}
            >
              {buttonLabel}
            </Button>
          ) : (
            visible_types.map(
              (viewset_name: string) =>
                viewsets[viewset_name].is_visible !== false && (
                  <Button
                    component={RouterLink}
                    to={
                      ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                      project_id +
                      ROUTES.RECORD_CREATE +
                      viewset_name
                    }
                    key={viewset_name}
                    startIcon={<AddIcon />}
                    sx={{
                      backgroundColor: 'green',
                      color: 'white',
                      borderRadius: '8px',
                      padding: '10px 15px',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      width: mq_above_sm ? 'auto' : '50%',
                      '&:hover': {
                        backgroundColor: 'darkgreen',
                      },
                    }}
                  >
                    {viewsets[viewset_name].label || `New ${viewset_name}`}
                  </Button>
                )
            )
          )}
          {/* Show the QR code button if configured for this project */}
          {showQRButton ? (
            <QRCodeButton
              key="scan-qr"
              label="Scan QR"
              onScanResult={handleScanResult}
            />
          ) : (
            <span />
          )}
        </ButtonGroup>
      </Box>
    );
  }
}
