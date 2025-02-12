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

import {RefreshOutlined} from '@mui/icons-material';
import AddCircleSharpIcon from '@mui/icons-material/AddCircleSharp';
import FolderIcon from '@mui/icons-material/Folder';
import {Alert, AlertTitle, Box, Button, Paper, Typography} from '@mui/material';
import {grey} from '@mui/material/colors';
import {useTheme} from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {GridColDef} from '@mui/x-data-grid';
import {useContext, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {
  NOTEBOOK_LIST_TYPE,
  NOTEBOOK_NAME,
  NOTEBOOK_NAME_CAPITALIZED,
} from '../../../buildconfig';
import * as ROUTES from '../../../constants/routes';
import {useNotification} from '../../../context/popup';
import {ProjectsContext} from '../../../context/projects-context';
import {ProjectExtended} from '../../../types/project';
import {userCanCreateNotebooks} from '../../../users';
import NotebookSyncSwitch from '../notebook/settings/sync_switch';
import HeadingProjectGrid from '../ui/heading-grid';
import Tabs from '../ui/tab-grid';
import {useAppSelector} from '../../../context/store';
import {selectActiveUser} from '../../../context/slices/authSlice';

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

export default function NoteBooks() {
  const [refresh, setRefreshing] = useState(false);

  // get the active user - this will allow us to check roles against it
  // TODO what do we do if this is not defined
  const activeUser = useAppSelector(selectActiveUser);
  const activeServerId = activeUser?.serverId;
  const activeUserToken = activeUser?.parsedToken;

  const {projects: allProjects, syncProjects} = useContext(ProjectsContext);
  const projects = allProjects.filter(p => {
    return p.listing === activeServerId;
  });

  const activeUserActivatedProjects = projects.filter(nb => nb.activated);

  const [tabID, setTabID] = useState('1');

  const history = useNavigate();

  const theme = useTheme();
  const not_xs = useMediaQuery(theme.breakpoints.up('sm'));

  const columns: GridColDef<ProjectExtended>[] = not_xs
    ? [
        {
          field: 'name',
          headerName: 'Name',
          type: 'string',
          flex: 0.4,
          minWidth: 200,
          renderCell: ({row: {activated, name, description}}) => (
            <Box my={3}>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'nowrap',
                  padding: '12px 0',
                }}
              >
                <FolderIcon
                  fontSize={'small'}
                  color={activated ? 'primary' : 'disabled'}
                  sx={{mr: '8px'}}
                />
                <Typography
                  variant={'body1'}
                  fontWeight={activated ? 'bold' : 'normal'}
                  color={activated ? 'black' : grey[800]}
                  sx={{
                    padding: '4px 0',
                    lineHeight: 1,
                  }}
                >
                  {name}
                </Typography>
              </span>
              <Typography variant={'caption'}>{description}</Typography>
            </Box>
          ),
        },
        // commenting this untill the functionality is fixed for this column.
        // {
        //   field: 'last_updated',
        //   headerName: 'Last Updated',
        //   type: 'dateTime',
        //   minWidth: 160,
        //   flex: 0.2,
        //   valueGetter: ({value}) => value && new Date(value),
        // },
        {
          field: 'actions',
          type: 'actions',
          flex: 0.2,
          minWidth: 160,
          headerName: 'Sync',
          description: `Toggle syncing this ${NOTEBOOK_NAME} to the server`,
          renderCell: ({row}) => (
            <NotebookSyncSwitch
              project={row}
              showHelperText={false}
              setTabID={setTabID}
            />
          ),
        },
      ]
    : [
        {
          field: 'name',
          headerName: 'Name',
          type: 'string',
          flex: 0.4,
          minWidth: 160,
          renderCell: ({row: {activated, name, description}}) => (
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: '12px 0',
                }}
              >
                <FolderIcon
                  fontSize={'small'}
                  color={activated ? 'secondary' : 'disabled'}
                  sx={{mr: '4px'}}
                />
                <Typography
                  variant={'body2'}
                  fontWeight={activated ? 'bold' : 'normal'}
                  color={activated ? 'black' : grey[800]}
                  sx={{
                    padding: '4px 0',
                  }}
                >
                  {name}
                </Typography>
              </div>
              <Typography variant={'caption'} sx={{paddingTop: '4px'}}>
                {description}
              </Typography>
            </div>
          ),
        },
        // commenting this until the functionality is fixed for this column.

        // {
        //   field: 'last_updated',
        //   headerName: 'Last Updated',
        //   type: 'dateTime',
        //   minWidth: 100,
        //   flex: 0.3,
        //   valueGetter: ({value}) => value && new Date(value),
        // },
        {
          field: 'actions',
          type: 'actions',
          flex: 0.3,
          minWidth: 80,
          headerName: 'Sync',
          description: `Toggle syncing this ${NOTEBOOK_NAME} to the server`,
          renderCell: ({row}) => (
            <NotebookSyncSwitch
              project={row}
              showHelperText={false}
              setTabID={setTabID}
            />
          ),
        },
      ];

  const showCreateNewNotebookButton =
    activeUserToken && userCanCreateNotebooks(activeUserToken);

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
      You have {activeUserActivatedProjects.length} {NOTEBOOK_NAME}
      {activeUserActivatedProjects.length !== 1 ? 's' : ''} currently{' '}
      {ACTIVATED_LABEL} on this device. {NOTEBOOK_NAME_CAPITALIZED}s in the{' '}
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

  return (
    <Box>
      <Box component={Paper} elevation={0} p={2}>
        <Typography variant={'body1'} gutterBottom>
          {notActivatedAdvice}
        </Typography>
        <div
          style={{display: 'flex', justifyContent: 'space-between', gap: '8px'}}
        >
          {/*  Hiding the "create new survey" button
         {showCreateNewNotebookButton ? (
            <Button
              variant="contained"
              onClick={() => history(ROUTES.CREATE_NEW_SURVEY)}
              sx={{mb: 3, mt: 3, backgroundColor: theme.palette.primary.main}}
              startIcon={<AddCircleSharpIcon />}
            >
              Create New rani {NOTEBOOK_NAME}
            </Button>
          ) : (
            <div />
          )} 
           */}

          <Button
            variant="contained"
            disabled={refresh}
            sx={{mb: 3, mt: 3, backgroundColor: theme.palette.primary.main}}
            startIcon={<RefreshOutlined />}
            onClick={async () => {
              setRefreshing(true);
              await syncProjects()
                .then(() => {
                  notify.showSuccess(`Refreshed ${NOTEBOOK_NAME_CAPITALIZED}s`);
                })
                .catch(e => {
                  console.log(e);
                  notify.showError(
                    `Issue while refreshing ${NOTEBOOK_NAME_CAPITALIZED}s.`
                  );
                });
              setRefreshing(false);
            }}
          >
            Refresh {NOTEBOOK_NAME}s
          </Button>
        </div>
        {NOTEBOOK_LIST_TYPE === 'tabs' ? (
          <Tabs
            projects={projects}
            tabID={tabID}
            handleChange={setTabID}
            columns={columns}
          />
        ) : (
          <HeadingProjectGrid projects={projects} columns={columns} />
        )}
        <Alert severity="info">
          <AlertTitle>
            What does {ACTIVATED_LABEL} and {NOT_ACTIVATED_LABEL} mean?
          </AlertTitle>
          When a {NOTEBOOK_NAME} is “{ACTIVATED_LABEL}” you are safe to work
          offline at any point because all the data you collect will be saved to
          your device. {ACTIVATE_ACTIVE_VERB_LABEL} a {NOTEBOOK_NAME} will start
          the downloading of existing {NOTEBOOK_NAME} records onto your device.
          We recommend you complete this procedure while you have a stable
          internet connection. Currently, you cannot{' '}
          {DE_ACTIVATE_VERB.toLowerCase()} a {NOTEBOOK_NAME}, this is something
          we will be adding soon. If you need to make space on your device you
          can clear the application storage or delete the application. If a{' '}
          {NOTEBOOK_NAME} is "{NOT_ACTIVATED_LABEL}" you are unable to start
          using it.
        </Alert>
      </Box>
    </Box>
  );
}
