import React, {useEffect, useState} from 'react';
import {Link as RouterLink, Navigate} from 'react-router-dom';

import {Box, Button, ButtonGroup, CircularProgress} from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';

import {useTheme} from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';

import * as ROUTES from '../../../constants/routes';
import {getUiSpecForProject} from '../../../uiSpecification';
import {QRCodeButton} from '../../fields/qrcode/QRCodeFormField';
import {
  ProjectInformation,
  getRecordsWithRegex,
  RecordMetadata,
  ProjectUIModel,
} from 'faims3-datamodel';
import {getMetadataValue} from '../../../sync/metadata';

type AddRecordButtonsProps = {
  project: ProjectInformation;
};

export default function AddRecordButtons(props: AddRecordButtonsProps) {
  const {project} = props;
  const project_id = project.project_id;
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
  }, []);

  if (uiSpec === undefined) {
    return <CircularProgress thickness={2} size={12} />;
  }
  const viewsets = uiSpec.viewsets;
  const visible_types = uiSpec.visible_types;

  const handleScanResult = (value: string) => {
    // find a record with this field value
    getRecordsWithRegex(project_id, value, true).then(records => {
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
          sx={{maxHeight: '400px', overflowY: 'scroll'}}
        >
          {/*If the list of views hasn't loaded yet*/}
          {/*we can still show this button, except it will*/}
          {/*redirect to the Record creation without known type*/}
          {visible_types.length === 1 ? (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<AddIcon />}
              component={RouterLink}
              key="newRecord"
              to={
                ROUTES.NOTEBOOK +
                project_id +
                ROUTES.RECORD_CREATE +
                visible_types
              }
            >
              New Record
            </Button>
          ) : (
            visible_types.map(
              (viewset_name: string) =>
                viewsets[viewset_name].is_visible !== false && (
                  <Button
                    component={RouterLink}
                    to={
                      ROUTES.NOTEBOOK +
                      project.project_id +
                      ROUTES.RECORD_CREATE +
                      viewset_name
                    }
                    key={viewset_name}
                    startIcon={<AddIcon />}
                  >
                    {viewsets[viewset_name].label || viewset_name}
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
