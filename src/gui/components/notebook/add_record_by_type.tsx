import React from 'react';
import {Link as RouterLink} from 'react-router-dom';

import {Box, Button, ButtonGroup, CircularProgress} from '@mui/material';

import AddIcon from '@mui/icons-material/Add';

import * as ROUTES from '../../../constants/routes';
import {ProjectInformation} from '../../../datamodel/ui';
import {getUiSpecForProject} from '../../../uiSpecification';
import {listenProjectDB} from '../../../sync';
import {useEventedPromise, constantArgsSplit} from '../../pouchHook';

type AddRecordButtonsProps = {
  project: ProjectInformation;
};

export default function AddRecordButtons(props: AddRecordButtonsProps) {
  const {project} = props;
  const project_id = project.project_id;

  const ui_spec = useEventedPromise(
    getUiSpecForProject,
    constantArgsSplit(
      listenProjectDB,
      [project_id, {since: 'now', live: true}],
      [project_id]
    ),
    true,
    [project_id],
    project_id
  );

  if (ui_spec.error) {
    console.error(`Error in gettings UISpec in ${project_id}`, ui_spec.error);
  }

  if (ui_spec.loading || ui_spec.value === undefined) {
    console.debug('Ui spec for', project_id, ui_spec);
    return <CircularProgress thickness={2} size={12} />;
  }
  const viewsets = ui_spec.value.viewsets;
  const visible_types = ui_spec.value.visible_types;

  return (
    <Box>
      {/*If the list of views hasn't loaded yet*/}
      {/*we can still show this button, except it will*/}
      {/*redirect to the Record creation without known type*/}
      {visible_types.length === 1 ? (
        <Button
          variant="outlined"
          color="primary"
          startIcon={<AddIcon />}
          component={RouterLink}
          to={
            ROUTES.PROJECT + project_id + ROUTES.RECORD_CREATE + visible_types
          }
        >
          New Record
        </Button>
      ) : (
        <ButtonGroup>
          {visible_types.map(
            viewset_name =>
              viewsets[viewset_name].is_visible !== false && (
                <Button
                  component={RouterLink}
                  to={
                    ROUTES.PROJECT +
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
          )}
        </ButtonGroup>
      )}
    </Box>
  );
}
