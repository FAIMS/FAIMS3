import {getRecordsWithRegex, RecordMetadata} from '@faims3/data-model';
import AddIcon from '@mui/icons-material/Add';
import AddCircleSharpIcon from '@mui/icons-material/AddCircleSharp';
import {Box, Button, ButtonGroup, CircularProgress} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useState} from 'react';
import {Navigate, Link as RouterLink} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {compiledSpecService} from '../../../context/slices/helpers/compiledSpecService';
import {Project} from '../../../context/slices/projectSlice';
import {useAppSelector} from '../../../context/store';
import {QRCodeButton} from '../../fields/qrcode/QRCodeFormField';

type AddRecordButtonsProps = {
  project: Project;
  recordLabel: string;
};

export default function AddRecordButtons({
  project: {projectId, serverId, uiSpecificationId, metadata},
  recordLabel,
}: AddRecordButtonsProps) {
  const theme = useTheme();
  // This page cannot load if no active user
  const activeUser = useAppSelector(selectActiveUser)!;
  const mq_above_md = useMediaQuery(theme.breakpoints.up('md'));
  const mq_above_sm = useMediaQuery(theme.breakpoints.up('sm'));
  const [selectedRecord, setSelectedRecord] = useState<
    RecordMetadata | undefined
  >(undefined);
  const showQRButton = metadata['showQRCodeButton'] === true;
  const buttonLabel = `Add new ${recordLabel}`;
  const uiSpecification = compiledSpecService.getSpec(uiSpecificationId);

  if (uiSpecification === undefined) {
    return <CircularProgress thickness={2} size={12} />;
  }
  const viewsets = uiSpecification.viewsets;
  const visible_types = uiSpecification.visible_types;

  const handleScanResult = (value: string) => {
    // find a record with this field value

    // TODO validate that this is always defined!
    // TODO WHY IS THERE TWO IDs - this is most likely broken
    getRecordsWithRegex(
      activeUser.parsedToken,
      projectId,
      value,
      true,
      uiSpecification
    ).then(records => {
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
          serverId,
          projectId || 'dummy',
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
          {uiSpecification?.visible_types.length === 1 ? (
            <Button
              variant="contained"
              color="primary"
              sx={{
                mb: 1,
                mt: 1,
                fontWeight: 'bold',
                backgroundColor: theme.palette.icon.main,
                color: theme.palette.primary.light,
                '&:hover': {
                  backgroundColor: theme.palette.secondary.dark,
                },
              }}
              startIcon={<AddCircleSharpIcon />}
              component={RouterLink}
              key="newRecord"
              to={
                ROUTES.INDIVIDUAL_NOTEBOOK_ROUTE +
                serverId +
                '/' +
                projectId +
                ROUTES.RECORD_CREATE +
                visible_types
              }
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
                      serverId +
                      '/' +
                      projectId +
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
