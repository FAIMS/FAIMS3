import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import CloudIcon from '@mui/icons-material/Cloud';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudQueueIcon from '@mui/icons-material/CloudQueue';
import ErrorIcon from '@mui/icons-material/Error';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Paper,
  Popper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material';
import {grey} from '@mui/material/colors';
import 'animate.css';
import moment from 'moment';
import React, {useCallback, useEffect, useState} from 'react';
import {syncStateService} from '../context/slices/helpers/syncStateService';
import {selectActiveServerProjects} from '../context/slices/projectSlice';
import {useAppSelector} from '../context/store';

const POLL_INTERVAL_MS = 1000;
const LAST_SYNC_FORMAT = 'MMMM Do YYYY, LTS';

// Aggregate status type
interface AggregatedSyncStatus {
  // Overall status of sync across all projects
  status: 'initial' | 'active' | 'paused' | 'error' | 'denied';
  // Is any project actively syncing data up?
  isSyncingUp: boolean;
  // Is any project actively syncing data down?
  isSyncingDown: boolean;
  // Is there any sync error?
  isSyncError: boolean;
  // The most recent error message (if any)
  errorMessage?: string;
  // The most recent update timestamp
  lastUpdated: number;
  // Number of projects with pending records
  pendingRecords: number;
  // Number of projects with active sync
  activeProjects: number;
  // Total number of projects being monitored
  totalProjects: number;
}

/**
 * Aggregates sync status from the sync state service
 *
 * @param projects List of active projects to check
 * @returns Aggregated sync status
 */
const aggregateSyncStatus = (
  projects: {projectId: string; serverId: string; isActivated: boolean}[]
): AggregatedSyncStatus => {
  // Default state when no projects are active
  if (!projects || projects.length === 0) {
    return {
      status: 'initial',
      isSyncingUp: false,
      isSyncingDown: false,
      isSyncError: false,
      lastUpdated: Date.now(),
      pendingRecords: 0,
      activeProjects: 0,
      totalProjects: 0,
    };
  }

  // Initialize counts and tracking variables
  let hasError = false;
  let hasActive = false;
  let hasDenied = false;
  let lastErrorMessage = '';
  let mostRecentUpdate = 0;
  let totalPendingRecords = 0;
  let syncingUpCount = 0;
  let syncingDownCount = 0;
  let activeProjectCount = 0;

  // Process each project
  for (const project of projects) {
    // Skip if project isn't activated
    if (!project.isActivated) continue;

    // Read directly from the service instead of Redux
    const syncState = syncStateService.getSyncState(
      project.serverId,
      project.projectId
    );
    if (!syncState) continue;

    activeProjectCount++;

    // Track the most recent update across all projects
    if (syncState.lastUpdated > mostRecentUpdate) {
      mostRecentUpdate = syncState.lastUpdated;
    }

    // Add up pending records
    totalPendingRecords += syncState.pendingRecords || 0;

    // Check for syncing activity
    if (syncState.status === 'active') {
      hasActive = true;

      // Check direction of sync
      if (syncState.lastChangeStats) {
        if (syncState.lastChangeStats.direction === 'push') {
          syncingUpCount++;
        } else if (syncState.lastChangeStats.direction === 'pull') {
          syncingDownCount++;
        }
      }
    }

    // Track errors
    if (syncState.status === 'error') {
      hasError = true;
      // Keep the most recent error message
      if (!lastErrorMessage && syncState.errorMessage) {
        lastErrorMessage = syncState.errorMessage;
      }
    }

    // Track denied status
    if (syncState.status === 'denied') {
      hasDenied = true;
      if (!lastErrorMessage && syncState.errorMessage) {
        lastErrorMessage = syncState.errorMessage;
      }
    }
  }

  // Determine the overall status (prioritize errors)
  let overallStatus: AggregatedSyncStatus['status'] = 'initial';

  if (hasError) {
    overallStatus = 'error';
  } else if (hasDenied) {
    overallStatus = 'denied';
  } else if (hasActive) {
    overallStatus = 'active';
  } else if (activeProjectCount > 0) {
    overallStatus = 'paused';
  }

  return {
    status: overallStatus,
    isSyncingUp: syncingUpCount > 0,
    isSyncingDown: syncingDownCount > 0,
    isSyncError: hasError || hasDenied,
    errorMessage: lastErrorMessage,
    lastUpdated: mostRecentUpdate,
    pendingRecords: totalPendingRecords,
    activeProjects: activeProjectCount,
    totalProjects: projects.length,
  };
};

/**
 * Hook to poll sync state only when active
 *
 * @param projects List of projects to monitor
 * @param isPolling Whether polling should be active
 * @returns Aggregated sync status
 */
function usePollSyncStatus(
  projects: {projectId: string; serverId: string; isActivated: boolean}[],
  isPolling: boolean
): AggregatedSyncStatus {
  const [aggregatedStatus, setAggregatedStatus] =
    useState<AggregatedSyncStatus>(() => aggregateSyncStatus(projects));

  const refresh = useCallback(() => {
    console.log('Refreshing sync status aggregation');
    setAggregatedStatus(aggregateSyncStatus(projects));
  }, [projects]);

  useEffect(() => {
    if (!isPolling) return;

    // Refresh immediately when we start polling
    refresh();

    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isPolling, refresh]);

  return aggregatedStatus;
}

export default function SyncStatus() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // Get all projects for the active server
  const activeServerProjects = useAppSelector(selectActiveServerProjects);

  // Only poll when the popover is open
  const aggregatedStatus = usePollSyncStatus(activeServerProjects, open);

  const {status, isSyncingUp, isSyncingDown, isSyncError, lastUpdated} =
    aggregatedStatus;

  const lastUpdatedDisplay = moment(lastUpdated).format(LAST_SYNC_FORMAT);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };

  const id = open ? 'simple-popper' : undefined;

  // Generate status message based on current state
  const getStatusMessage = () => {
    if (isSyncError) {
      return (
        aggregatedStatus.errorMessage ||
        'Cannot sync to server, your device may be offline.'
      );
    } else if (isSyncingUp || isSyncingDown) {
      return `Sync is underway${
        aggregatedStatus.pendingRecords > 0
          ? ` (${aggregatedStatus.pendingRecords} pending)`
          : ''
      }`;
    } else if (status === 'paused') {
      return 'Sync is paused';
    } else {
      return 'Waiting for changes';
    }
  };

  // Get the simple status label
  const getStatusLabel = () => {
    if (isSyncError) {
      return 'Error';
    } else if (isSyncingUp || isSyncingDown) {
      return 'In Progress';
    } else if (status === 'paused') {
      return 'Paused';
    } else {
      return 'Idle';
    }
  };

  return (
    <React.Fragment>
      <Button
        aria-describedby={id}
        variant="text"
        type={'button'}
        onClick={handleClick}
        sx={{p: 0}}
      >
        <Box
          sx={{
            justifyContent: 'center',
            position: 'relative',
            display: ' inline-flex',
            alignItems: 'center',
            verticalAlign: 'middle',
            mx: 2,
            width: '40px',
          }}
        >
          <Box display="flex" justifyContent="center" sx={{height: '100%'}}>
            {isSyncError ? (
              <React.Fragment>
                <CloudOffIcon
                  style={{marginLeft: '11px'}}
                  sx={{color: 'primary'}}
                />
                <ErrorIcon
                  style={{fontSize: '20px', marginTop: '-5px'}}
                  color={'warning'}
                />
              </React.Fragment>
            ) : isSyncingUp || isSyncingDown ? (
              <CloudIcon sx={{color: 'primary'}} />
            ) : (
              <CloudQueueIcon sx={{color: 'primary'}} />
            )}
          </Box>
          {!isSyncError ? (
            <Grid
              container
              style={{
                marginLeft: '-32px',
                maxHeight: '64px',
                marginBottom: '-3px',
              }}
              spacing={0}
            >
              <Grid item xs={12}>
                <Box display="flex" justifyContent="center">
                  <ArrowDropUpIcon
                    sx={{fontSize: '32px'}}
                    color={!isSyncingUp ? 'disabled' : 'warning'}
                    className={
                      isSyncingUp
                        ? 'animate__animated animate__flash animate__slow animate__infinite'
                        : ''
                    }
                  />
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Box display="flex" justifyContent="center">
                  <ArrowDropDownIcon
                    sx={{fontSize: '32px'}}
                    color={!isSyncingDown ? 'disabled' : 'warning'}
                    className={
                      isSyncingDown
                        ? 'animate__animated animate__flash animate__slow animate__infinite'
                        : ''
                    }
                  />
                </Box>
              </Grid>
            </Grid>
          ) : (
            ''
          )}
        </Box>
      </Button>
      <Popper id={id} open={open} anchorEl={anchorEl}>
        <Card variant="outlined">
          <CardContent sx={{p: 0, paddingBottom: '0 !important'}}>
            <CardHeader
              title={'Sync Status'}
              sx={{textAlign: 'center', backgroundColor: grey[200], p: 1}}
            />
            <TableContainer component={Paper} elevation={0}>
              <Table
                sx={{maxWidth: 250, fontSize: 14, mb: 0}}
                aria-label="sync table"
                size={'small'}
              >
                <TableBody>
                  <TableRow>
                    <TableCell sx={{verticalAlign: 'top'}}>Status</TableCell>
                    <TableCell sx={{verticalAlign: 'top', textAlign: 'right'}}>
                      <Typography color="text.secondary" sx={{fontSize: 14}}>
                        {getStatusLabel()}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        gutterBottom
                        variant={'caption'}
                      >
                        {getStatusMessage()}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{verticalAlign: 'top'}}>Last Sync</TableCell>
                    <TableCell sx={{verticalAlign: 'top', textAlign: 'right'}}>
                      <Typography
                        color="text.secondary"
                        gutterBottom
                        sx={{fontSize: 14}}
                      >
                        {lastUpdatedDisplay}
                      </Typography>
                    </TableCell>
                  </TableRow>
                  {aggregatedStatus.activeProjects > 0 && (
                    <TableRow>
                      <TableCell sx={{verticalAlign: 'top'}}>
                        Projects
                      </TableCell>
                      <TableCell
                        sx={{verticalAlign: 'top', textAlign: 'right'}}
                      >
                        <Typography
                          color="text.secondary"
                          gutterBottom
                          sx={{fontSize: 14}}
                        >
                          {aggregatedStatus.activeProjects} active /{' '}
                          {aggregatedStatus.totalProjects} total
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </Popper>
    </React.Fragment>
  );
}
