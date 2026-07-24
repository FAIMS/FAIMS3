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
import {AddOutlined, RefreshOutlined} from '@mui/icons-material';
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
  Tooltip,
  Typography,
} from '@mui/material';
import {grey} from '@mui/material/colors';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {GridColDef} from '@mui/x-data-grid';
import {useMutation} from '@tanstack/react-query';
import {useState} from 'react';
import {config, CAPACITOR_PLATFORM} from '../../../buildconfig';
import {useNotification} from '../../../context/popup';
import {selectActiveUser} from '../../../context/slices/authSlice';
import {
  initialiseProjects,
  Project,
  selectProjectsByServerId,
  selectServers,
} from '../../../context/slices/projectSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {
  formatNotebookListDescription,
  isNotebookListDescriptionTruncated,
} from '../../../lib/notebookListDisplay';
import {useIsOnline} from '../../../utils/customHooks';
import {
  QRCodeButtonOnly,
  ShortCodeOnlyComponent,
} from '../authentication/shortCodeOnly';
import NotebookSyncSwitch from '../notebook/settings/sync_switch';
import HeadingProjectGrid from '../ui/heading-grid';
import Tabs from '../ui/tab-grid';

// Notebook status naming conventions (labels are fixed English; surrounding UI uses config.notebookName* from build config).

// E.g. "This notebook is not active"
export const NOT_ACTIVATED_LABEL = 'Not Active';

// E.g. "This notebook is active"
export const ACTIVATED_LABEL = 'Active';

// E.g. "This notebook has been activated"
export const ACTIVATED_VERB_PAST = 'Activated';

// E.g. "Please activate this notebook"
export const ACTIVATE_VERB_LABEL = 'Activate';

// E.g. "This notebook is currently activating" or "Before activating, consider ..."
export const ACTIVATE_ACTIVE_VERB_LABEL = 'Activating';

// E.g. "You cannot currently de-activate a notebook"
export const DE_ACTIVATE_VERB = 'De-activate';
export const DE_ACTIVATE_ACTIVE_VERB = 'De-activating';

export const notebookListDataGridSx = {
  '& .MuiDataGrid-cell': {
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
  },
  '& .MuiDataGrid-row': {
    minHeight: '75px !important',
  },
};

export default function NoteBooks() {
  // get the active user - this will allow us to check roles against it
  // TODO what do we do if this is not defined
  const dispatch = useAppDispatch();

  // Are we online
  const isOnline = useIsOnline();
  const activeUser = useAppSelector(selectActiveUser);
  const activeServerId = activeUser?.serverId ?? '';
  const projects = useAppSelector(state =>
    selectProjectsByServerId(state, activeServerId)
  ).filter(
    // don't show de-activated closed notebooks
    project =>
      !(!project.isActivated && project.status === ProjectStatus.CLOSED)
  );
  // use notification service
  const notify = useNotification();
  // Refresh mutation
  const doRefresh = useMutation({
    mutationFn: async () => {
      if (!activeUser) return;
      await dispatch(initialiseProjects({serverId: activeUser.serverId}));
    },
    onSuccess: () => {
      notify.showSuccess(`Refreshed ${config.notebookNamePluralCapitalized}`);
    },
    onError: err => {
      console.log(err);
      notify.showError(
        `Issue while refreshing ${config.notebookNamePluralCapitalized}.`
      );
    },
  });
  const [tabID, setTabID] = useState('1');
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const theme = useTheme();
  const is_xs = !useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const servers = useAppSelector(selectServers);
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  if (!activeUser) {
    // You shouldn't be here!
    return <></>;
  }

  const showRefreshButton = isOnline.isOnline;
  const activatedProjects = projects.filter(nb => nb.isActivated);

  const baseColumns: GridColDef<Project>[] = [
    {
      field: 'name',
      headerName: 'Name',
      type: 'string',
      flex: 0.4,
      renderCell: ({row}) => {
        const listDescription = formatNotebookListDescription(row.description);
        const descriptionTypography = (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              ...(isNotebookListDescriptionTruncated(row.description)
                ? {cursor: 'help'}
                : {}),
            }}
          >
            {listDescription}
          </Typography>
        );

        return (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0,
            }}
          >
            <Typography
              variant={is_xs ? 'body2' : 'body1'}
              sx={{
                fontWeight: row.isActivated ? 'bold' : 'normal',
                color: row.isActivated ? 'black' : grey[800],
              }}
            >
              {row.name ?? 'Unknown ' + config.notebookNameCapitalized}
            </Typography>
            {listDescription &&
              (isNotebookListDescriptionTruncated(row.description) ? (
                <Tooltip title={row.description?.trim() ?? ''}>
                  <span>{descriptionTypography}</span>
                </Tooltip>
              ) : (
                descriptionTypography
              ))}
          </Box>
        );
      },
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
  const isTabs = config.notebookListType === 'tabs';
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
      You have {activatedProjects.length}{' '}
      {activatedProjects.length !== 1
        ? config.notebookNamePlural
        : config.notebookName}{' '}
      currently {ACTIVATED_LABEL} on this device.{' '}
      {config.notebookNamePluralCapitalized} in the{' '}
      {isTabs ? (
        <>{buildTabLink('not active')}</>
      ) : (
        <>
          "{NOT_ACTIVATED_LABEL}" {sectionLabel}
        </>
      )}{' '}
      need to be {ACTIVATED_VERB_PAST.toLowerCase()} before they can be used. To
      start using a {config.notebookNameCapitalized} in the{' '}
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

  const platform = CAPACITOR_PLATFORM;
  const allowQr = platform === 'ios' || platform === 'android';

  return (
    <Box
      component={Paper}
      elevation={0}
      sx={{p: 2, width: '100%', minWidth: 0}}
    >
      <Stack
        direction={isMobile ? 'column' : 'row'}
        spacing={2}
        sx={{
          mt: 1,
          mb: 2,
          alignItems: isMobile ? 'stretch' : 'center',
          justifyContent: isMobile ? 'space-evenly' : 'space-between',
        }}
      >
        <Stack direction="row" spacing={1} sx={{flex: 1, alignItems: 'center'}}>
          <Button
            variant="contained"
            disabled={!showRefreshButton || doRefresh.isPending}
            sx={{backgroundColor: theme.palette.primary.main, flex: 1}}
            startIcon={<RefreshOutlined />}
            onClick={() => {
              doRefresh.mutate();
            }}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            sx={{backgroundColor: theme.palette.primary.main, flex: 1}}
            startIcon={<AddOutlined />}
            data-testid="app-notebooks-add-button"
            onClick={() => {
              setAddDialogOpen(true);
            }}
          >
            Add {config.notebookName}
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
          Learn about {ACTIVATE_ACTIVE_VERB_LABEL.toLowerCase()}/
          {DE_ACTIVATE_ACTIVE_VERB.toLowerCase()} {config.notebookNamePlural}
        </Button>
      </Stack>
      {config.notebookListType === 'tabs' ? (
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

      {/* Custom floating overlay for "Add notebook" - not Material Dialog, so it doesn't conflict with QR scanner's overlay */}
      <Box
        sx={{
          display: addDialogOpen ? 'flex' : 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: theme.zIndex.modal,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.5)',
          p: 2,
        }}
        onClick={() => setAddDialogOpen(false)}
        role="presentation"
      >
        <Paper
          elevation={8}
          sx={{
            maxWidth: 'sm',
            width: '100%',
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          <Box sx={{p: 2.5, pb: 0}}>
            <Typography variant="h4" gutterBottom>
              Add a new {config.notebookNameCapitalized}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{mb: 2}}>
              {allowQr
                ? `Enter an access code or scan a QR code to get access to a ${config.notebookName}.`
                : `Enter an access code to get access to a ${config.notebookName}.`}
            </Typography>
          </Box>
          <Box sx={{px: 2.5, py: 2, borderTop: 1, borderColor: 'divider'}}>
            {servers.length > 0 && (
              <Stack spacing={3} sx={{mt: 1}}>
                <Box>
                  <Typography
                    variant="subtitle1"
                    sx={{fontWeight: 'bold', mb: 1.5}}
                  >
                    Enter code
                  </Typography>
                  <ShortCodeOnlyComponent servers={servers} />
                </Box>
                {allowQr && (
                  <Box>
                    <Typography
                      variant="subtitle1"
                      sx={{fontWeight: 'bold', mb: 1.5}}
                    >
                      Scan QR code
                    </Typography>
                    <QRCodeButtonOnly
                      servers={servers}
                      onScanStart={() => setAddDialogOpen(false)}
                    />
                  </Box>
                )}
              </Stack>
            )}
          </Box>
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderTop: 1,
              borderColor: 'divider',
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            <Button onClick={() => setAddDialogOpen(false)}>Close</Button>
          </Box>
        </Paper>
      </Box>

      <Dialog
        open={infoDialogOpen}
        onClose={() => setInfoDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h4">
            {ACTIVATE_ACTIVE_VERB_LABEL} {config.notebookNamePluralCapitalized}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{mb: 2}}>
            <strong>"{ACTIVATE_ACTIVE_VERB_LABEL}"</strong> a{' '}
            {config.notebookName} ensures that you are safe to work offline at
            any point by downloading any existing records onto your device.
            Please do this with a stable internet connection.
          </Typography>
          <Typography sx={{mb: 2}}>
            <strong>"{DE_ACTIVATE_ACTIVE_VERB}"</strong> a {config.notebookName}{' '}
            offloads records from your device, to{' '}
            {DE_ACTIVATE_VERB.toLowerCase()} a {config.notebookName}:
          </Typography>
          <Typography component="div">
            <ol style={{margin: '8px 0', paddingLeft: '20px'}}>
              <li>
                Select the {config.notebookName} you want to{' '}
                {DE_ACTIVATE_VERB.toLowerCase()}
              </li>
              <li>
                Ensure you are online, and all data in the {config.notebookName}{' '}
                has been synced to the cloud
              </li>
              <li>
                Click <strong>"Settings"</strong> tab (next to Map and Details
                tabs)
              </li>
              <li>
                Select the red{' '}
                <strong>
                  "{DE_ACTIVATE_VERB} {config.notebookName}"
                </strong>{' '}
                at the bottom that looks like the following:
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
                    {DE_ACTIVATE_VERB} {config.notebookNameCapitalized}
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
