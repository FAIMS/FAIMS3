import React, {useEffect, useState} from 'react';
import {Box, Switch, FormControlLabel, Typography} from '@material-ui/core';

import {ProjectInformation} from '../../../datamodel/ui';
import {
  isSyncingProject,
  setSyncingProject,
  listenSyncingProject,
} from '../../../sync/sync-toggle';
import {USE_REAL_DATA} from '../../../buildconfig';

type ProjectSyncProps = {
  project: ProjectInformation;
};

export default function ProjectSync(props: ProjectSyncProps) {
  const {project} = props;
  const [isSyncing, setIsSyncing] = useState(
    isSyncingProject(project.project_id)
  );

  useEffect(() => {
    return listenSyncingProject(project.project_id, setIsSyncing);
  }, [project.project_id]);

  return (
    <React.Fragment>
      <Box p={1}>
        <FormControlLabel
          control={
            <Switch
              disabled={!USE_REAL_DATA}
              checked={isSyncing}
              onChange={(event, checked) =>
                setSyncingProject(project.project_id, checked)
              }
            />
          }
          label={<Typography variant={'button'}>Sync</Typography>}
        />
      </Box>
    </React.Fragment>
  );
}
