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
 * Filename: about-build.tsx
 * Description:
 *   About-build page: configured app identity, and local maintenance actions.
 */

import React, {useEffect, useRef} from 'react';
import PouchDB from 'pouchdb-browser';
import {
  Box,
  Paper,
  Divider,
  Button,
  Typography,
  Grid,
  Alert,
  AlertTitle,
  LinearProgress,
  AppBar,
  Toolbar,
  Checkbox,
  FormControl,
  FormControlLabel,
  Link,
  Stack,
} from '@mui/material';
import {grey} from '@mui/material/colors';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import ShareIcon from '@mui/icons-material/Share';
import StorageIcon from '@mui/icons-material/Storage';
import * as ROUTES from '../../constants/routes';
import {unregister as unregisterServiceWorker} from '../../serviceWorkerRegistration';
import {progressiveSaveFiles} from '../../sync/data-dump';
import {AutosuggestSource, config} from '../../buildconfig';
import Breadcrumbs from '../components/ui/breadcrumbs';
import BoxTab from '../components/ui/boxTab';
import DialogActions from '@mui/material/DialogActions';
import Dialog from '@mui/material/Dialog';
import {clearReduxAndLocalStorage, wipeAllDatabases} from '../../context/store';
import {logError} from '../../logging';
import {databaseService} from '../../context/slices/helpers/databaseService';
import {Link as RouterLink} from 'react-router-dom';

/** Shared wrapping rules so long URLs, hashes, and names stay inside the panel. */
const wrappingValueSx = {
  overflowWrap: 'anywhere',
  wordBreak: 'break-word',
  minWidth: 0,
} as const;

type ConfigurationRow = {
  label: string;
  value: React.ReactNode;
};

/**
 * Friendly label for a configured map or satellite provider id.
 * Unknown ids are shown as configured so a custom source is still visible.
 */
function friendlyProviderName(source: string): string {
  const known: Record<string, string> = {
    osm: 'OpenStreetMap',
    maptiler: 'MapTiler',
    esri: 'Esri',
  };
  const trimmed = source.trim();
  if (!trimmed) {
    return 'Not configured';
  }
  return known[trimmed.toLowerCase()] ?? trimmed;
}

/**
 * Map line for the about panel: tile provider, and satellite imagery when set.
 * API keys are never included.
 */
function describeMaps(): string {
  const parts = [friendlyProviderName(config.mapSource)];
  if (config.satelliteSource) {
    parts.push(`satellite: ${friendlyProviderName(config.satelliteSource)}`);
  }
  return parts.join(' · ');
}

/**
 * Address-search provider when one is configured. Returns undefined for the
 * default (no autosuggest) so the row stays off the basic info list.
 */
function describeAddressSearch(): string | undefined {
  switch (config.autosuggestSource) {
    case AutosuggestSource.MAPBOX:
      return 'Mapbox';
    case AutosuggestSource.MAPTILER:
      return 'MapTiler';
    default:
      return undefined;
  }
}

/** External URL shown as its own wrapping link. */
function ExternalValue({href}: {href: string}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      variant="body2"
      sx={wrappingValueSx}
    >
      {href}
    </Link>
  );
}

/**
 * Basic build identity for this installation: configured names, where it
 * connects, and how to get help. Secrets (map keys, directory passwords)
 * are omitted.
 */
function configurationRows(): ConfigurationRow[] {
  const serverLabel = config.conductorUrls.length > 1 ? 'Servers' : 'Server';
  const addressSearch = describeAddressSearch();
  const rows: ConfigurationRow[] = [
    {label: 'App', value: config.headingAppName},
  ];

  if (config.appName !== config.headingAppName) {
    rows.push({label: 'App name', value: config.appName});
  }

  rows.push(
    {label: 'App ID', value: config.appId},
    {
      label: serverLabel,
      value: (
        <Stack spacing={0.5} sx={{minWidth: 0}}>
          {config.conductorUrls.map(url => (
            <Typography key={url} variant="body2" sx={wrappingValueSx}>
              {url}
            </Typography>
          ))}
        </Stack>
      ),
    },
    {label: 'Version', value: config.appVersion},
    {label: 'Commit', value: config.commitHash ?? 'Not provided.'},
    {
      label: 'Records called',
      value: `${config.notebookName} (${config.notebookNamePlural})`,
    },
    {label: 'Maps', value: describeMaps()},
    {label: 'Offline maps', value: config.offlineMaps ? 'On' : 'Off'}
  );

  if (addressSearch) {
    rows.push({label: 'Address search', value: addressSearch});
  }

  rows.push(
    {
      label: 'Support',
      value: (
        <Link
          href={`mailto:${config.supportEmail}`}
          underline="hover"
          variant="body2"
          sx={wrappingValueSx}
        >
          {config.supportEmail}
        </Link>
      ),
    },
    {
      label: 'Privacy policy',
      value: <ExternalValue href={config.privacyPolicyUrl} />,
    }
  );

  if (config.contactUrl) {
    rows.push({
      label: 'Contact',
      value: <ExternalValue href={config.contactUrl} />,
    });
  }

  if (config.runningUnderTest) {
    rows.push({label: 'Mode', value: 'Running under test'});
  }

  return rows;
}

/** Definition list for the about-build configuration tab. */
function BuildConfiguration() {
  const rows = configurationRows();

  return (
    <Box sx={{mb: 2, minWidth: 0, maxWidth: '100%'}}>
      <BoxTab
        title={`${config.headingAppName} configuration`}
        bgcolor={grey[100]}
      />
      <Box
        data-testid="build-configuration"
        sx={{
          bgcolor: grey[100],
          px: 2,
          py: 0.5,
          minWidth: 0,
          borderBottomLeftRadius: '4px',
          borderBottomRightRadius: '4px',
        }}
      >
        {rows.map(row => (
          <Box
            key={row.label}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'minmax(9rem, 11rem) minmax(0, 1fr)',
              },
              columnGap: 2,
              rowGap: 0.25,
              alignItems: 'baseline',
              py: 1,
              borderBottom: '1px solid',
              borderColor: 'grey.300',
              '&:last-of-type': {borderBottom: 0},
            }}
          >
            <Typography
              variant="body2"
              component="div"
              sx={{fontWeight: 600, color: 'text.secondary'}}
            >
              {row.label}
            </Typography>
            {typeof row.value === 'string' ? (
              <Typography variant="body2" component="div" sx={wrappingValueSx}>
                {row.value}
              </Typography>
            ) : (
              <Box sx={{minWidth: 0}}>{row.value}</Box>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function AboutBuild() {
  const breadcrumbs = [
    {link: ROUTES.INDEX, title: 'Home'},
    {title: 'about-build'},
  ];

  const [wipeDialogOpen, setWipeDialogOpen] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [showingProgress, setShowingProgress] = React.useState(false);
  const [progressiveDump, setProgressiveDump] = React.useState(false);
  const [progressMessage, setProgressMessage] = React.useState('');
  const [pouchDBDebug, setPouchDBDebug] = React.useState(false);

  const togglePouchDBDebug = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPouchDBDebug(event.target.checked);
    console.log('current debug state is ', PouchDB.debug.enabled('*'));
    if (event.target.checked) {
      console.log('PouchDB Debug Logging enabled');
      PouchDB.debug.enable('*');
    } else {
      console.log('PouchDB Debug Logging disabled');
      PouchDB.debug.disable();
    }
    console.log('now debug state is ', PouchDB.debug.enabled('*'));
  };

  // need useRef here because this value is used in a callback which
  // needs to see the live value so that when we cancel, it can
  // pass back to the caller.  Just using `progressiveDump` here
  // doesn't work as it freezes the value from the time of the initial
  // call to `progressiveSaveFiles`
  const keepDumping = useRef(false);

  // update progress and return true if the dump should continue
  const handleProgress = (progress: number): boolean => {
    setProgress(progress);
    if (progress < 0) {
      keepDumping.current = false;
      setProgressMessage('Share is not available on this device/browser');
      setProgressiveDump(false);
    }
    if (progress > 100) {
      setProgressMessage('Share is complete');
      setShowingProgress(false);
    }
    return keepDumping.current;
  };

  useEffect(() => {
    if (progressiveDump) {
      keepDumping.current = true;
      progressiveSaveFiles(handleProgress);
    } else {
      keepDumping.current = false;
    }
  }, [progressiveDump]);

  const handleShareDump = async () => {
    setShowingProgress(true);
    setProgressiveDump(true);
  };

  const handleCancelDump = () => {
    setProgressiveDump(false);
    setShowingProgress(false);
  };

  return (
    <Box sx={{p: 2}}>
      <Breadcrumbs data={breadcrumbs} />
      <BuildConfiguration />
      <Box
        component={Paper}
        sx={{p: 2, my: {xs: 1, sm: 2}}}
        elevation={0}
        variant={'outlined'}
      >
        <Grid
          container
          direction="row"
          spacing={2}
          sx={{justifyContent: 'flex-start', alignItems: 'flex-start'}}
        >
          <Grid size={{md: 4, sm: 6, xs: 12}}>
            <Typography variant={'h5'} gutterBottom>
              Having issues?
            </Typography>

            <Typography variant={'body2'}>
              Refresh the app (this is similar to a browser refresh)
            </Typography>
          </Grid>
          <Grid size={{md: 8, sm: 6, xs: 12}}>
            <Button
              variant="contained"
              color={'primary'}
              size={'small'}
              disableElevation
              onClick={() => {
                logError('User refreshed page');
                unregisterServiceWorker();
                window.location.reload();
              }}
              startIcon={<RefreshIcon />}
            >
              Refresh the app
            </Button>
          </Grid>
          <Grid size={{md: 4, sm: 6, xs: 12}}>
            <Typography variant={'body2'}>
              Refresh local database connections. Use this if you see errors
              indicating that that the app can't read or write data. No data
              will be lost by doing this.
            </Typography>
          </Grid>
          <Grid size={{md: 8, sm: 6, xs: 12}}>
            <Button
              variant="contained"
              color={'warning'}
              size={'small'}
              disableElevation
              onClick={() => {
                logError('User reset local databases');
                databaseService.validateLocalDatabases();
              }}
              startIcon={<RefreshIcon />}
            >
              Refresh local database connections
            </Button>
          </Grid>

          <Grid size={{xs: 12}}>
            <Divider />
          </Grid>
          <Grid size={{md: 4, sm: 6, xs: 12}}>
            <Typography variant={'h5'} gutterBottom>
              Backup from this device
            </Typography>

            <Typography variant={'body2'}>
              Share or save a file containing all {config.notebookNamePlural}{' '}
              and records stored on this device. Data download functionality is
              not well-supported by all device+browser combinations.
            </Typography>
          </Grid>
          <Grid size={{md: 8, sm: 6, xs: 12}}>
            <Grid container spacing={2} sx={{alignItems: 'center'}}>
              <Grid>
                <Button
                  disableElevation
                  size={'small'}
                  color={'info'}
                  variant={'contained'}
                  onClick={handleShareDump}
                  startIcon={<ShareIcon />}
                >
                  Share local database contents
                </Button>
              </Grid>
            </Grid>
          </Grid>
          {/* For debugging only - testing database damage handling this will close all databases */}
          {false && (
            <>
              <Grid size={{md: 4, sm: 6, xs: 12}}>
                <Typography variant={'h5'} gutterBottom>
                  Do Damage!
                </Typography>
              </Grid>
              <Grid size={{md: 8, sm: 6, xs: 12}}>
                <Button
                  variant="contained"
                  color={'error'}
                  size={'small'}
                  disableElevation
                  onClick={() => {
                    databaseService.damage();
                  }}
                  startIcon={<RefreshIcon />}
                >
                  Damage local databases
                </Button>
              </Grid>
            </>
          )}
          {(config.showWipe || config.showPouchdbBrowser) && (
            <React.Fragment>
              <Grid size={{xs: 12}}>
                <Divider />
              </Grid>
              <Divider flexItem orientation={'horizontal'} />
              <Grid size={{md: 4, sm: 6, xs: 12}}>
                <Typography variant={'h5'} gutterBottom>
                  Developer Tools
                </Typography>

                <Typography variant={'body2'}>
                  Use the following with care! "Wipe and Reset" will delete all
                  data stored on this device and require you to login again.
                  "Raw Database Interface" is a tool for developers to inspect
                  inspect the raw data stored on this device.
                </Typography>
              </Grid>
              <Grid size={{md: 8, sm: 6, xs: 12}}>
                <Grid container spacing={2} sx={{alignItems: 'center'}}>
                  {config.showWipe && (
                    <Grid>
                      <Button
                        onClick={() => setWipeDialogOpen(true)}
                        color={'error'}
                        variant={'contained'}
                        disableElevation={true}
                        startIcon={<ErrorIcon />}
                      >
                        Wipe and reset everything
                      </Button>
                      <Dialog
                        open={wipeDialogOpen}
                        onClose={() => setWipeDialogOpen(false)}
                        aria-labelledby="alert-dialog-title"
                        aria-describedby="alert-dialog-description"
                      >
                        <Alert severity={'warning'}>
                          <AlertTitle>Are you sure?</AlertTitle>
                          Go ahead and wipe all local databases?
                        </Alert>
                        <DialogActions className="dialog-actions-spread">
                          <Button
                            onClick={() => setWipeDialogOpen(false)}
                            autoFocus
                            color={'warning'}
                          >
                            Cancel
                          </Button>
                          <Button
                            size={'small'}
                            variant="contained"
                            disableElevation
                            color={'error'}
                            onClick={async () => {
                              unregisterServiceWorker();
                              // wipe all local databases
                              await wipeAllDatabases()
                                .then(clearReduxAndLocalStorage)
                                .then(() => {
                                  console.log('User cleaned database');
                                  window.location.reload();
                                });
                            }}
                            startIcon={<StorageIcon />}
                          >
                            Reset local DB
                          </Button>
                        </DialogActions>
                      </Dialog>
                    </Grid>
                  )}
                  {config.showPouchdbBrowser && (
                    <>
                      <Grid>
                        <Button
                          size={'small'}
                          variant="contained"
                          disableElevation
                          color={'warning'}
                          startIcon={<StorageIcon />}
                          component={RouterLink}
                          to={ROUTES.POUCH_EXPLORER}
                        >
                          Open Raw Database Interface
                        </Button>
                      </Grid>
                      <Grid>
                        <FormControl>
                          <FormControlLabel
                            control={
                              <Checkbox
                                checked={pouchDBDebug}
                                onChange={togglePouchDBDebug}
                              />
                            }
                            label="Enable PouchDB Debug Logging"
                          />
                        </FormControl>
                      </Grid>
                    </>
                  )}
                </Grid>
              </Grid>
            </React.Fragment>
          )}
        </Grid>
      </Box>
      <Dialog open={showingProgress}>
        <AppBar sx={{position: 'relative'}}>
          <Toolbar>
            <Typography sx={{ml: 2, flex: 1}} variant="h6" component="div">
              {progressMessage
                ? progressMessage
                : 'Preparing to Share Database Dump...'}
            </Typography>
            <Button autoFocus color="inherit" onClick={handleCancelDump}>
              {progressMessage ? 'Dismiss' : 'Cancel'}
            </Button>
          </Toolbar>
        </AppBar>
        <LinearProgress variant="determinate" value={progress} />
      </Dialog>
    </Box>
  );
}
