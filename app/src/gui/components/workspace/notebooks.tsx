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
 * Filename: project-list.tsx
 * Description:
 *   TODO
 */

import {ProjectStatus} from '@faims3/data-model';
import {RefreshOutlined} from '@mui/icons-material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {grey} from '@mui/material/colors';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {GridColDef} from '@mui/x-data-grid';
import {useMutation} from '@tanstack/react-query';
import {useState} from 'react';
import {
  NOTEBOOK_LIST_TYPE,
  NOTEBOOK_NAME,
  NOTEBOOK_NAME_CAPITALIZED,
} from '../../../buildconfig';
import {useNotification} from '../../../context/popup';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {
  initialiseProjects,
  Project,
  selectProjectsByServerId,
} from '../../../context/slices/projectSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {useIsOnline} from '../../../utils/customHooks';
import NotebookSyncSwitch from '../notebook/settings/sync_switch';
import HeadingProjectGrid from '../ui/heading-grid';
import Tabs from '../ui/tab-grid';

// Survey status naming conventions

// E.g. "This survey is not active"
export const NOT_ACTIVATED_LABEL = 'Not Active';

// E.g. "This survey is active"
export const ACTIVATED_LABEL = 'Active';

// E.g. "This survey has been activated"
export const ACTIVATED_VERB_PAST = 'Activated';

// E.g. "Please activate this survey"
export const ACTIVATE_VERB_LABEL = 'Activate';

// E.g. "This survey is currently activating" or "Before activating, consider ..."
export const ACTIVATE_ACTIVE_VERB_LABEL = 'Activating';

// E.g. "You cannot currently de-activate a survey"
export const DE_ACTIVATE_VERB = 'De-activate';
export const DE_ACTIVATE_ACTIVE_VERB = 'De-activating';

export default function NoteBooks() {
  // get the active user - this will allow us to check roles against it
  // TODO what do we do if this is not defined
  const dispatch = useAppDispatch();

  // Are we online
  const isOnline = useIsOnline();
  const activeUser = useAppSelector(selectActiveUser);
  if (!activeUser) {
    // You shouldn't be here!
    return <></>;
  }

  const activeServerId = activeUser.serverId;
  const projects = useAppSelector(state =>
    selectProjectsByServerId(state, activeServerId)
  ).filter(
    // don't show de-activated closed surveys
    project =>
      !(!project.isActivated && project.status === ProjectStatus.CLOSED)
  );

  // Refresh mutation
  const doRefresh = useMutation({
    mutationFn: async () => {
      await dispatch(initialiseProjects({serverId: activeServerId}));
    },
    onSuccess: () => {
      notify.showSuccess(`Refreshed ${NOTEBOOK_NAME_CAPITALIZED}s`);
    },
    onError: err => {
      console.log(err);
      notify.showError(`Issue while refreshing ${NOTEBOOK_NAME_CAPITALIZED}s.`);
    },
  });
  const showRefreshButton = isOnline.isOnline;

  const activatedProjects = projects.filter(nb => nb.isActivated);

  const [tabID, setTabID] = useState('1');
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);

  const theme = useTheme();
  const is_xs = !useMediaQuery(theme.breakpoints.up('sm'));

  const baseColumns: GridColDef<Project>[] = [
    {
      field: 'name',
      headerName: 'Name',
      type: 'string',
      flex: 0.4,
      renderCell: ({row}) => (
        <Box>
          <Typography
            variant={is_xs ? 'body2' : 'body1'}
            fontWeight={row.isActivated ? 'bold' : 'normal'}
            color={row.isActivated ? 'black' : grey[800]}
            sx={{
              padding: '8px 0px',
            }}
          >
            {row.name ??
              // Just as a backwards compat thing, consider looking for name in
              // metadata
              row.metadata.name ??
              'Unknown ' + NOTEBOOK_NAME_CAPITALIZED}
          </Typography>
          <Typography variant="caption" sx={{display: 'block', mt: 1}}>
            {row.metadata.description}
          </Typography>
        </Box>
      ),
    },
  ];
  const activatedColumns = baseColumns;
  const notActivatedColumns = baseColumns.concat([
    {
      field: 'actions',
      type: 'actions',
      width: 100,
      renderCell: ({row}) => (
        <NotebookSyncSwitch
          project={row}
          showHelperText={false}
          setTabID={setTabID}
        />
      ),
    },
  ]);

  // What type of layout are we using?
  const isTabs = NOTEBOOK_LIST_TYPE === 'tabs';
  const sectionLabel = isTabs ? 'tab' : 'section';

  const buildTabLink = (target: 'active' | 'not active') => {
    switch (target) {
      case 'active':
        return (
          <Button variant="text" size={'medium'} onClick={() => setTabID('1')}>
            "{ACTIVATED_LABEL}" tab
          </Button>
        );
      case 'not active':
        return (
          <Button variant="text" size={'medium'} onClick={() => setTabID('2')}>
            {NOT_ACTIVATED_LABEL} tab
          </Button>
        );
    }
  };

  const notActivatedAdvice = (
    <>
      You have {activatedProjects.length} {NOTEBOOK_NAME}
      {activatedProjects.length !== 1 ? 's' : ''} currently {ACTIVATED_LABEL} on
      this device. {NOTEBOOK_NAME_CAPITALIZED}s in the{' '}
      {isTabs ? (
        <>{buildTabLink('not active')}</>
      ) : (
        <>
          "{NOT_ACTIVATED_LABEL}" {sectionLabel}
        </>
      )}{' '}
      need to be {ACTIVATED_VERB_PAST.toLowerCase()} before they can be used. To
      start using a {NOTEBOOK_NAME_CAPITALIZED} in the{' '}
      {isTabs ? (
        <>{buildTabLink('not active')}</>
      ) : (
        <>
          "{NOT_ACTIVATED_LABEL}" {sectionLabel}
        </>
      )}{' '}
      click the "{ACTIVATE_VERB_LABEL}" button.
    </>
  );

  // use notification service
  const notify = useNotification();

  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box component={Paper} elevation={0} p={2}>
      <Stack
        direction={isMobile ? 'column' : 'row'}
        alignItems={isMobile ? 'stretch' : 'center'}
        justifyContent={isMobile ? 'space-evenly' : 'space-between'}
        spacing={2}
        sx={{mt: 1, mb: 2}}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            variant="contained"
            disabled={!showRefreshButton || doRefresh.isPending}
            fullWidth={isMobile}
            sx={{backgroundColor: theme.palette.primary.main}}
            startIcon={<RefreshOutlined />}
            onClick={() => {
              doRefresh.mutate();
            }}
          >
            Refresh {NOTEBOOK_NAME}s
          </Button>
          {doRefresh.isPending && <CircularProgress size={24} />}
        </Stack>
        <Button
          variant="outlined"
          size="small"
          fullWidth={isMobile}
          startIcon={<InfoOutlinedIcon fontSize="small" />}
          onClick={() => setInfoDialogOpen(true)}
          sx={{
            textTransform: 'none',
            fontSize: 'body2.fontSize',
          }}
        >
          Learn more about activating {NOTEBOOK_NAME}s
        </Button>
      </Stack>
      {NOTEBOOK_LIST_TYPE === 'tabs' ? (
        <Tabs
          projects={projects}
          tabID={tabID}
          handleChange={setTabID}
          activatedColumns={activatedColumns}
          notActivatedColumns={notActivatedColumns}
        />
      ) : (
        <HeadingProjectGrid
          projects={projects}
          serverId={activeServerId}
          activatedColumns={activatedColumns}
          notActivatedColumns={notActivatedColumns}
        />
      )}

      {activatedProjects.length === 0 && (
        <Typography variant={'body1'} gutterBottom>
          {notActivatedAdvice}
        </Typography>
      )}

      <Dialog
        open={infoDialogOpen}
        onClose={() => setInfoDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h4">
            {ACTIVATE_ACTIVE_VERB_LABEL} {NOTEBOOK_NAME_CAPITALIZED}s
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography paragraph>
            <strong>"{ACTIVATE_ACTIVE_VERB_LABEL}"</strong> a {NOTEBOOK_NAME}{' '}
            ensures that you are safe to work offline at any point by
            downloading any existing records onto your device. Please do this
            with a stable internet connection.
          </Typography>
          <Typography paragraph>
            <strong>"{DE_ACTIVATE_ACTIVE_VERB}"</strong> a {NOTEBOOK_NAME}{' '}
            offloads records from your device, to{' '}
            {DE_ACTIVATE_VERB.toLowerCase()} a {NOTEBOOK_NAME}:
          </Typography>
          <Typography component="div">
            <ol style={{margin: '8px 0', paddingLeft: '20px'}}>
              <li>
                Select the {NOTEBOOK_NAME} you want to{' '}
                {DE_ACTIVATE_VERB.toLowerCase()}
              </li>
              <li>
                Ensure you are online, and all data in the {NOTEBOOK_NAME} has
                been synced to the cloud
              </li>
              <li>
                Click <strong>"Settings"</strong> tab (next to Map and Details
                tabs)
              </li>
              <li>
                Select the red{' '}
                <strong>
                  "{DE_ACTIVATE_VERB} {NOTEBOOK_NAME}"
                </strong>{' '}
                at the bottom
                <Box sx={{mt: 1, mb: 0.5}}>
                  <Button
                    variant="outlined"
                    color="error"
                    size="small"
                    disableRipple
                    sx={{
                      pointerEvents: 'none',
                      textTransform: 'uppercase',
                      fontSize: '0.75rem',
                      py: 0.5,
                      px: 1,
                    }}
                  >
                    {DE_ACTIVATE_VERB} {NOTEBOOK_NAME_CAPITALIZED}
                  </Button>
                </Box>
              </li>
            </ol>
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
