import {getRecordsWithRegex, RecordMetadata} from '@faims3/data-model';
import {Refresh} from '@mui/icons-material';
import AddCircleSharpIcon from '@mui/icons-material/AddCircleSharp';
import {Button, ButtonGroup, CircularProgress, Stack} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {useState} from 'react';
import {Navigate, Link as RouterLink} from 'react-router-dom';
import {localGetDataDb} from '../../..';
import * as ROUTES from '../../../constants/routes';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {compiledSpecService} from '../../../context/slices/helpers/compiledSpecService';
import {Project} from '../../../context/slices/projectSlice';
import {useAppSelector} from '../../../context/store';
import {QRCodeButton} from '../../fields/qrcode/QRCodeFormField';

type AddRecordButtonsProps = {
  project: Project;
  recordLabel: string;
  refreshList: () => void;
};

export default function AddRecordButtons({
  project: {projectId, serverId, uiSpecificationId, metadata},
  refreshList,
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
    getRecordsWithRegex({
      dataDb: localGetDataDb(projectId),
      filterDeleted: true,
      projectId,
      regex: value,
      tokenContents: activeUser.parsedToken,
      uiSpecification,
    }).then(records => {
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
      <Stack direction={{xs: 'column', sm: 'row'}}>
        <ButtonGroup
          fullWidth={mq_above_md ? false : true}
          orientation={mq_above_sm ? 'horizontal' : 'vertical'}
          sx={{
            maxHeight: '400px',
            justifyContent: mq_above_sm ? 'flex-start' : 'center',
            gap: '0px',
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
                    startIcon={<AddCircleSharpIcon />}
                    variant="contained"
                    sx={{
                      borderRadius: '8px',
                      fontWeight: 'bold',
                      backgroundColor: theme.palette.icon.main,
                      '&:hover': {
                        backgroundColor: theme.palette.secondary.dark,
                      },
                    }}
                  >
                    {viewsets[viewset_name].label || `New ${viewset_name}`}
                  </Button>
                )
            )
          )}
        </ButtonGroup>

        <ButtonGroup
          fullWidth={mq_above_md ? false : true}
          orientation={mq_above_sm ? 'horizontal' : 'vertical'}
          sx={{
            ml: mq_above_sm ? '10px' : '0px',
            mt: mq_above_sm ? '0px' : '10px',
          }}
        >
          {/* Show the QR code button if configured for this project */}
          {showQRButton && (
            <QRCodeButton
              key="scan-qr"
              label="Scan QR"
              onScanResult={handleScanResult}
            />
          )}
          <Button
            variant="outlined"
            sx={{
              fontWeight: 'bold',
            }}
            startIcon={<Refresh />}
            key="refreshList"
            onClick={refreshList}
          >
            Refresh Records
          </Button>
        </ButtonGroup>
      </Stack>
    );
  }
}
