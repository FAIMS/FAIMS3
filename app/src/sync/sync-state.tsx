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
import React, {useMemo} from 'react';
import {
  Project,
  selectActiveServerProjects,
} from '../context/slices/projectSlice';
import {useAppSelector} from '../context/store';

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
 * Aggregates sync status from multiple projects
 *
 * @param projects List of active projects to check
 * @returns Aggregated sync status
 */
const aggregateSyncStatus = (projects: Project[]): AggregatedSyncStatus => {
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
    // Skip if project isn't activated or doesn't have remote connection
    if (!project.isActivated || !project.database?.remote?.syncState) {
      continue;
    }

    const syncState = project.database.remote.syncState;
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
  let overallStatus: 'initial' | 'active' | 'paused' | 'error' | 'denied' =
    'initial';

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

export default function SyncStatus() {
  // Get all projects for the active server
  const activeServerProjects = useAppSelector(selectActiveServerProjects);

  // Compute aggregated sync status
  const aggregatedStatus = useMemo(
    () => aggregateSyncStatus(activeServerProjects),
    [activeServerProjects]
  );

  const {status, isSyncingUp, isSyncingDown, isSyncError, lastUpdated} =
    aggregatedStatus;

  const LAST_SYNC_FORMAT = 'MMMM Do YYYY, LTS';
  const lastUpdatedDisplay = moment(lastUpdated).format(LAST_SYNC_FORMAT);

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };

  const open = Boolean(anchorEl);
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
