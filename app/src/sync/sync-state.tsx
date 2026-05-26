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
import moment from 'moment';
import React, {useCallback, useEffect, useState} from 'react';
import {syncStateService} from '../context/slices/helpers/syncStateService';
import {selectActiveServerProjects} from '../context/slices/projectSlice';
import {useAppSelector} from '../context/store';

/** Polling interval when the popover is open (frequent updates) */
const POLL_INTERVAL_ACTIVE_MS = 1000;

/** Polling interval when the popover is closed (background updates for icon) */
const POLL_INTERVAL_BACKGROUND_MS = 10000;

/** Date format for displaying last sync time */
const LAST_SYNC_FORMAT = 'MMMM Do YYYY, LTS';

/**
 * Aggregated sync status across all active projects.
 * Provides a unified view of sync state for display purposes.
 */
interface AggregatedSyncStatus {
  /** Overall status of sync across all projects */
  status: 'initial' | 'active' | 'paused' | 'error' | 'denied';
  /** Whether any project is actively pushing data to the server */
  isSyncingUp: boolean;
  /** Whether any project is actively pulling data from the server */
  isSyncingDown: boolean;
  /** Whether any project has a sync error or denied status */
  isSyncError: boolean;
  /** The most recent error message, if any */
  errorMessage?: string;
  /** Timestamp of the most recent sync activity */
  lastUpdated: number;
  /** Total number of pending records across all projects */
  pendingRecords: number;
  /** Number of projects with active sync monitoring */
  activeProjects: number;
  /** Total number of projects being tracked */
  totalProjects: number;
}

/**
 * Project reference for sync status tracking.
 */
interface ProjectReference {
  projectId: string;
  serverId: string;
  isActivated: boolean;
}

/**
 * Aggregates sync status from all active projects into a single status object.
 *
 * Processes each project's sync state and combines them into an overall status,
 * prioritising errors over other states.
 *
 * @param projects - List of projects to aggregate status from
 * @returns Combined sync status across all projects
 */
const aggregateSyncStatus = (
  projects: ProjectReference[]
): AggregatedSyncStatus => {
  // Return default state when no projects are available
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

  // Tracking variables for aggregation
  let hasError = false;
  let hasActive = false;
  let hasDenied = false;
  let lastErrorMessage = '';
  let mostRecentUpdate = 0;
  let totalPendingRecords = 0;
  let syncingUpCount = 0;
  let syncingDownCount = 0;
  let activeProjectCount = 0;

  // Process each project's sync state
  for (const project of projects) {
    // Skip deactivated projects
    if (!project.isActivated) continue;

    const syncState = syncStateService.getSyncState(
      project.serverId,
      project.projectId
    );
    if (!syncState) continue;

    activeProjectCount++;

    // Track the most recent update timestamp
    if (syncState.lastUpdated > mostRecentUpdate) {
      mostRecentUpdate = syncState.lastUpdated;
    }

    // Accumulate pending records
    totalPendingRecords += syncState.pendingRecords || 0;

    // Check sync activity and direction
    if (syncState.status === 'active') {
      hasActive = true;

      if (syncState.lastChangeStats) {
        if (syncState.lastChangeStats.direction === 'push') {
          syncingUpCount++;
        } else if (syncState.lastChangeStats.direction === 'pull') {
          syncingDownCount++;
        }
      }
    }

    // Track error states (capture first error message)
    if (syncState.status === 'error') {
      hasError = true;
      if (!lastErrorMessage && syncState.errorMessage) {
        lastErrorMessage = syncState.errorMessage;
      }
    }

    // Track denied states (capture first error message)
    if (syncState.status === 'denied') {
      hasDenied = true;
      if (!lastErrorMessage && syncState.errorMessage) {
        lastErrorMessage = syncState.errorMessage;
      }
    }
  }

  // Determine overall status with priority: error > denied > active > paused > initial
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
 * Hook to poll sync status with adaptive polling rates.
 *
 * Polls at a fast rate (1s) when the UI is actively being viewed (popover open),
 * and at a slower rate (10s) in the background to keep the icon up-to-date
 * without excessive overhead.
 *
 * @param projects - List of projects to monitor
 * @param isActivelyViewing - Whether the user is actively viewing sync details
 * @returns Current aggregated sync status
 */
function usePollSyncStatus(
  projects: ProjectReference[],
  isActivelyViewing: boolean
): AggregatedSyncStatus {
  const [aggregatedStatus, setAggregatedStatus] =
    useState<AggregatedSyncStatus>(() => aggregateSyncStatus(projects));

  const refresh = useCallback(() => {
    setAggregatedStatus(aggregateSyncStatus(projects));
  }, [projects]);

  useEffect(() => {
    // Always refresh immediately on mount or when projects/viewing state changes
    refresh();

    // Set polling interval based on whether user is actively viewing
    const intervalMs = isActivelyViewing
      ? POLL_INTERVAL_ACTIVE_MS
      : POLL_INTERVAL_BACKGROUND_MS;

    const interval = setInterval(refresh, intervalMs);

    return () => clearInterval(interval);
  }, [isActivelyViewing, refresh]);

  return aggregatedStatus;
}

/**
 * Sync status indicator component.
 *
 * Displays a cloud icon in the header that reflects the current sync state
 * across all active projects. Clicking the icon opens a popover with detailed
 * sync information.
 *
 * Icon states:
 * - CloudOff + Warning: Sync error or denied
 * - Cloud (solid): Actively syncing
 * - CloudQueue (outline): Idle/waiting for changes
 *
 * The component uses adaptive polling:
 * - Background (10s): Keeps the icon state current
 * - Active (1s): Provides real-time updates when popover is open
 */
export default function SyncStatus() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const isPopoverOpen = Boolean(anchorEl);

  // Get all projects for the active server
  const activeServerProjects = useAppSelector(selectActiveServerProjects);

  // Poll sync status with adaptive rate based on popover visibility
  const aggregatedStatus = usePollSyncStatus(
    activeServerProjects,
    isPopoverOpen
  );

  const {status, isSyncingUp, isSyncingDown, isSyncError, lastUpdated} =
    aggregatedStatus;

  const lastUpdatedDisplay = moment(lastUpdated).format(LAST_SYNC_FORMAT);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(anchorEl ? null : event.currentTarget);
  };

  const popperId = isPopoverOpen ? 'sync-status-popper' : undefined;

  /**
   * Generates a descriptive status message based on current sync state.
   */
  const getStatusMessage = (): string => {
    if (isSyncError) {
      return (
        aggregatedStatus.errorMessage ||
        'Cannot sync to server, your device may be offline.'
      );
    }

    if (isSyncingUp || isSyncingDown) {
      const pendingText =
        aggregatedStatus.pendingRecords > 0
          ? ` (${aggregatedStatus.pendingRecords} pending)`
          : '';
      return `Sync is underway${pendingText}`;
    }

    if (status === 'paused') {
      return 'Sync is paused';
    }

    return 'Waiting for changes';
  };

  /**
   * Returns a short status label for the current sync state.
   */
  const getStatusLabel = (): string => {
    if (isSyncError) return 'Error';
    if (isSyncingUp || isSyncingDown) return 'In Progress';
    if (status === 'paused') return 'Complete';
    return 'Complete';
  };

  /**
   * Renders the appropriate cloud icon based on current sync state.
   */
  const renderCloudIcon = () => {
    if (isSyncError) {
      return (
        <Box display="flex" alignItems="center">
          <CloudOffIcon sx={{color: 'primary.main'}} />
          <ErrorIcon
            sx={{fontSize: '16px', ml: -0.5, mt: -1.5}}
            color="warning"
          />
        </Box>
      );
    }

    if (isSyncingUp || isSyncingDown) {
      return <CloudIcon sx={{color: 'primary.main'}} />;
    }

    return <CloudQueueIcon sx={{color: 'primary.main'}} />;
  };

  return (
    <React.Fragment>
      {/* Sync status button with cloud icon */}
      <Button
        aria-describedby={popperId}
        variant="text"
        type="button"
        onClick={handleClick}
        sx={{p: 0, minWidth: 'auto'}}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            mx: 2,
          }}
        >
          {renderCloudIcon()}
        </Box>
      </Button>

      {/* Sync status details popover */}
      <Popper
        id={popperId}
        open={isPopoverOpen}
        anchorEl={anchorEl}
        sx={{zIndex: 1300}}
      >
        <Card variant="outlined">
          <CardContent sx={{p: 0, paddingBottom: '0 !important'}}>
            <CardHeader
              title="Sync Status"
              sx={{textAlign: 'center', backgroundColor: grey[200], p: 1}}
            />
            <TableContainer component={Paper} elevation={0}>
              <Table
                sx={{maxWidth: 250, fontSize: 14, mb: 0}}
                aria-label="sync status details"
                size="small"
              >
                <TableBody>
                  {/* Current status row */}
                  <TableRow>
                    <TableCell sx={{verticalAlign: 'top'}}>Status</TableCell>
                    <TableCell sx={{verticalAlign: 'top', textAlign: 'right'}}>
                      <Typography color="text.secondary" sx={{fontSize: 14}}>
                        {getStatusLabel()}
                      </Typography>
                      <Typography
                        color="text.secondary"
                        gutterBottom
                        variant="caption"
                      >
                        {getStatusMessage()}
                      </Typography>
                    </TableCell>
                  </TableRow>

                  {/* Last sync timestamp row */}
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

                  {/* Project count row (only shown when projects are active) */}
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
