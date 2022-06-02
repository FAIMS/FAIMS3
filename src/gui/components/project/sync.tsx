/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: sync.tsx
 * Description:
 * This provides a react component to manage the syncing state of a specific
 * project via a toggle.
 */
import React, {useEffect, useState} from 'react';
import {Box, Switch, FormControlLabel, Typography} from '@mui/material';

import {ProjectInformation} from '../../../datamodel/ui';
import {
  isSyncingProject,
  setSyncingProject,
  listenSyncingProject,
} from '../../../sync/sync-toggle';

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
              checked={isSyncing}
              onChange={async (event, checked) => {
                await setSyncingProject(project.project_id, checked);
              }}
            />
          }
          label={<Typography variant={'button'}>Sync</Typography>}
        />
      </Box>
    </React.Fragment>
  );
}
