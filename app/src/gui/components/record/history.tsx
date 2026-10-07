// SPDX-License-Identifier: Apache-2.0
/**
 * Record History tab: a date-grouped timeline of who created, updated, or
 * deleted a record, with expandable changed-field details.
 */
import {
  computeRecursiveRecordHistory,
  DataEngine,
  formatTimestamp,
  ProjectID,
  RecordID,
  RevisionHistoryEntry,
  UiSpecModel,
} from '@faims3/data-model';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Timeline from '@mui/lab/Timeline';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineItem from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import {
  Box,
  CircularProgress,
  IconButton,
  Link,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {useQuery} from '@tanstack/react-query';
import {Fragment, useMemo, useState, type ReactElement} from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {
  getViewRecordRoute,
  RecordRouteNotebook,
} from '../../../constants/routes';
import {buildRecordHistoryKey} from '../../../utils/customHooks';
import {
  flattenRecordHistory,
  formatHistoryEventDate,
  formatHistoryEventTime,
  getChangedFieldIds,
  getFieldLabels,
  getHistoryEventAction,
  getHistoryEventActor,
  getHistoryEventKind,
  getHistoryEventSubtitle,
  groupHistoryByDate,
  toLocalDateKey,
  type FlattenedHistoryEvent,
  type HistoryEventKind,
} from './historyUtils';

const HISTORY_MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace';

const HISTORY_ICONS: Record<HistoryEventKind, ReactElement> = {
  created: <AddCircleOutlineIcon fontSize="small" />,
  updated: <EditNoteOutlinedIcon fontSize="small" />,
  deleted: <DeleteOutlineIcon fontSize="small" />,
};

const HISTORY_MARKER: Record<
  HistoryEventKind,
  'markerCreated' | 'markerUpdated' | 'markerDeleted'
> = {
  created: 'markerCreated',
  updated: 'markerUpdated',
  deleted: 'markerDeleted',
};

/**
 * Presentational timeline. Kept separate from the query wrapper so tests can
 * render a fixed history without standing up a DataEngine.
 */
export function RecordHistoryTimeline({
  events,
  uiSpec,
  rootRecordId,
  notebook,
}: {
  events: FlattenedHistoryEvent[];
  uiSpec: UiSpecModel;
  rootRecordId?: string;
  notebook?: RecordRouteNotebook;
}) {
  const theme = useTheme();
  const sortedEvents = useMemo(
    () => events.slice().sort((a, b) => b.created.localeCompare(a.created)),
    [events]
  );
  const groups = useMemo(
    () => groupHistoryByDate(sortedEvents),
    [sortedEvents]
  );
  const revisionsByRecord = useMemo(() => {
    const map = new Map<string, RevisionHistoryEntry[]>();
    for (const event of sortedEvents) {
      const list = map.get(event.recordId) ?? [];
      list.push(event.entry);
      map.set(event.recordId, list);
    }
    return map;
  }, [sortedEvents]);

  if (groups.length === 0) {
    return (
      <Typography color="text.secondary">
        No revision history is available for this record.
      </Typography>
    );
  }

  return (
    <Timeline
      position="right"
      className="faims-recordHistory-timeline"
      data-testid="record-history-timeline"
    >
      {sortedEvents.map((event, index) => {
        const previous = sortedEvents[index - 1];
        const showDateHeader =
          !previous ||
          toLocalDateKey(new Date(event.created)) !==
            toLocalDateKey(new Date(previous.created));
        const groupLabel = groups.find(
          group => group.key === toLocalDateKey(new Date(event.created))
        )?.label;
        const recordRevisions = revisionsByRecord.get(event.recordId) ?? [];
        const revisionById = new Map(
          recordRevisions.map(entry => [entry.revisionId, entry] as const)
        );

        return (
          <Fragment key={`${event.recordId}-${event.entry.revisionId}`}>
            {showDateHeader && groupLabel && (
              <TimelineItem
                className="faims-recordHistory-date"
                data-testid="record-history-group"
                sx={{minHeight: 0}}
              >
                <TimelineSeparator sx={{display: 'none'}} />
                <TimelineContent sx={{p: 0, pt: index === 0 ? 0 : 0.5}}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'stretch',
                      gap: 2,
                    }}
                  >
                    <Box
                      aria-hidden
                      sx={{
                        width: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}
                    >
                      {index > 0 && (
                        <Box
                          sx={{
                            width: 2,
                            flex: 1,
                            backgroundColor: theme.palette.history.connector,
                          }}
                        />
                      )}
                      <Box
                        sx={{
                          width: 2,
                          flex: 1,
                          minHeight: 20,
                          backgroundColor: theme.palette.history.connector,
                        }}
                      />
                    </Box>
                    <Typography
                      variant="overline"
                      sx={{
                        display: 'block',
                        color: 'text.secondary',
                        letterSpacing: '0.08em',
                        fontWeight: theme.typography.fontWeightMedium,
                        lineHeight: 1.4,
                      }}
                    >
                      {groupLabel}
                    </Typography>
                  </Box>
                </TimelineContent>
              </TimelineItem>
            )}
            <HistoryEventItem
              event={event}
              uiSpec={uiSpec}
              rootRecordId={rootRecordId}
              notebook={notebook}
              revisionById={revisionById}
              sortedHistory={recordRevisions}
              showConnector={index < sortedEvents.length - 1}
            />
          </Fragment>
        );
      })}
    </Timeline>
  );
}

function historyAnchor(recordId: string | undefined, revisionId: string) {
  return recordId ? `${recordId}-${revisionId}` : revisionId;
}

function HistoryEventItem({
  event,
  uiSpec,
  rootRecordId,
  notebook,
  revisionById,
  sortedHistory,
  showConnector,
}: {
  event: FlattenedHistoryEvent;
  uiSpec: UiSpecModel;
  rootRecordId?: string;
  notebook?: RecordRouteNotebook;
  revisionById: Map<string, RevisionHistoryEntry>;
  sortedHistory: RevisionHistoryEntry[];
  showConnector: boolean;
}) {
  const theme = useTheme();
  const [detailsAnchor, setDetailsAnchor] = useState<HTMLElement | null>(null);
  const {entry, recordId, formId, hrid} = event;
  const kind = getHistoryEventKind(entry);
  const fieldIds = getChangedFieldIds(entry);
  const fieldCount = fieldIds.length;
  const createdAt = new Date(entry.created);
  const parentFields = Object.entries(entry.changedFields);
  const historyIndex = sortedHistory.findIndex(
    item => item.revisionId === entry.revisionId
  );
  const isOtherRecord = Boolean(rootRecordId && recordId !== rootRecordId);
  const subtitle = getHistoryEventSubtitle({uiSpec, formId});

  const formatRevisionMetadata = (target?: RevisionHistoryEntry) =>
    target
      ? `${target.createdBy} at ${formatTimestamp(new Date(target.created).getTime())}`
      : 'unknown';

  return (
    <TimelineItem
      id={historyAnchor(recordId, entry.revisionId)}
      data-testid="record-history-event"
      data-kind={kind}
    >
      <TimelineSeparator sx={{display: 'none'}} />
      <TimelineContent sx={{p: 0}}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 2,
            width: '100%',
            minWidth: 0,
          }}
        >
          <Box
            aria-hidden
            sx={{
              width: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                height: 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: theme.palette.history[HISTORY_MARKER[kind]],
                }}
              />
            </Box>
            {showConnector && (
              <Box
                sx={{
                  width: 2,
                  flex: 1,
                  minHeight: 8,
                  backgroundColor: theme.palette.history.connector,
                }}
              />
            )}
          </Box>
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              flex: 1,
              minWidth: 0,
              alignItems: 'flex-start',
              flexWrap: 'nowrap',
            }}
          >
            <Box
              aria-hidden
              data-testid={`record-history-icon-${kind}`}
              sx={{
                width: 40,
                height: 40,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 1,
                backgroundColor: theme.palette.history.iconBackground,
                color: theme.palette.history.iconForeground,
              }}
            >
              {HISTORY_ICONS[kind]}
            </Box>
            <Box sx={{minWidth: 0, flex: '1 1 0'}}>
              <Typography
                sx={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  letterSpacing: '-0.015em',
                  lineHeight: 1.3,
                  color: 'text.primary',
                  overflowWrap: 'anywhere',
                }}
              >
                {getHistoryEventAction(kind)}
                {isOtherRecord && (
                  <>
                    {' '}
                    <Box
                      component="span"
                      sx={{
                        fontFamily: HISTORY_MONO_FONT,
                        // fontWeight: theme.typography.fontWeightBold,
                        fontWeight: theme.typography.fontWeightLight,
                        fontSize: 'inherit',
                        color: 'text.primary',
                      }}
                    >
                      Child
                    </Box>
                  </>
                )}{' '}
                {subtitle}
              </Typography>
              <Typography
                sx={{
                  mt: 0.75,
                  fontFamily: HISTORY_MONO_FONT,
                  fontSize: '0.75rem',
                  fontWeight: theme.typography.fontWeightMedium,
                  letterSpacing: '-0.015em',
                  lineHeight: 1.3,
                  color: 'text.secondary',
                  overflowWrap: 'anywhere',
                }}
              >
                {getHistoryEventActor(entry)}
              </Typography>
            </Box>
            <IconButton
              size="small"
              aria-label="Event details"
              aria-expanded={Boolean(detailsAnchor)}
              data-testid="record-history-details"
              onClick={event => setDetailsAnchor(event.currentTarget)}
              sx={{
                ml: 'auto',
                flexShrink: 0,
                height: 40,
                color: 'text.secondary',
                alignSelf: 'flex-start',
              }}
            >
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
            <Popover
              open={Boolean(detailsAnchor)}
              anchorEl={detailsAnchor}
              onClose={() => setDetailsAnchor(null)}
              anchorOrigin={{vertical: 'bottom', horizontal: 'right'}}
              transformOrigin={{vertical: 'top', horizontal: 'right'}}
              slotProps={{
                paper: {
                  sx: {
                    px: 2,
                    py: 1.5,
                    minWidth: 220,
                    maxWidth: 320,
                    maxHeight: 'min(20rem, 70vh)',
                    overflowY: 'auto',
                    borderRadius: 2,
                    boxShadow: theme.shadows[3],
                  },
                },
              }}
            >
              <Stack spacing={1.25}>
                {isOtherRecord && (
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{letterSpacing: '0.06em'}}
                    >
                      Record
                    </Typography>
                    <Typography variant="body2">
                      {notebook ? (
                        <Link
                          component={RouterLink}
                          to={getViewRecordRoute({...notebook, recordId})}
                        >
                          {hrid}
                        </Link>
                      ) : (
                        hrid
                      )}
                    </Typography>
                  </Box>
                )}
                <Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{letterSpacing: '0.06em'}}
                  >
                    Time
                  </Typography>
                  <Typography variant="body2">
                    {formatHistoryEventDate(createdAt)}
                    {' · '}
                    {formatHistoryEventTime(createdAt)}
                  </Typography>
                </Box>
                {fieldCount > 0 && (
                  <Box>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{letterSpacing: '0.06em'}}
                    >
                      {`${fieldCount} ${fieldCount === 1 ? 'field' : 'fields'} changed`}
                    </Typography>
                    <Stack spacing={1} sx={{mt: 0.5}}>
                      {parentFields.map(([parentId, fields]) => {
                        const showComparison =
                          revisionById.has(parentId) &&
                          (parentFields.length > 1 ||
                            parentId !==
                              sortedHistory[historyIndex + 1]?.revisionId);
                        const labels = getFieldLabels(fields, uiSpec);
                        return (
                          <Box key={parentId}>
                            {showComparison && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{display: 'block', mb: 0.5}}
                              >
                                Compared to{' '}
                                <Link
                                  href={`#${historyAnchor(recordId, parentId)}`}
                                >
                                  {formatRevisionMetadata(
                                    revisionById.get(parentId)
                                  )}
                                </Link>
                              </Typography>
                            )}
                            <Stack
                              component="ul"
                              spacing={0.25}
                              sx={{m: 0, pl: 2}}
                            >
                              {labels.map((label, labelIndex) => (
                                <Typography
                                  key={`${parentId}-${fields[labelIndex]}`}
                                  component="li"
                                  variant="body2"
                                >
                                  {label}
                                </Typography>
                              ))}
                            </Stack>
                          </Box>
                        );
                      })}
                    </Stack>
                  </Box>
                )}
              </Stack>
            </Popover>
          </Stack>
        </Box>
      </TimelineContent>
    </TimelineItem>
  );
}

/**
 * Fetches the viewed record's revision tree (including child records) and
 * renders one chronological timeline.
 */
export function HistoryTabContent({
  recordId,
  projectId,
  dataEngine,
  uiSpec,
  notebook,
}: {
  recordId: RecordID;
  projectId: ProjectID;
  dataEngine: DataEngine;
  uiSpec: UiSpecModel;
  notebook: RecordRouteNotebook;
}) {
  const {data, isError, isPending, error} = useQuery({
    queryKey: buildRecordHistoryKey({projectId, recordId}),
    queryFn: () =>
      computeRecursiveRecordHistory({
        engine: dataEngine,
        recordId,
        projectId,
      }),
    networkMode: 'always',
    // Refetch on every mount so the trail is fresh, but keep the cached data
    // available during the background refetch so revisiting the tab does not
    // blank the list behind a spinner.
    refetchOnMount: 'always',
  });

  if (isPending) {
    return (
      <Box sx={{display: 'flex', justifyContent: 'center', p: 4}}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box sx={{p: 2}}>
        <Typography color="error">
          An error occurred while fetching record history. Error:{' '}
          {error?.message ?? 'unknown'}.
        </Typography>
      </Box>
    );
  }

  if (!data) {
    return (
      <Box sx={{p: 2}}>
        <Typography color="error">Record data not found.</Typography>
      </Box>
    );
  }

  return (
    <Box
      data-testid="record-history"
      sx={{
        px: 1,
        pb: 1,
        width: '100%',
        maxWidth: 720,
        mr: 'auto',
      }}
    >
      <RecordHistoryTimeline
        events={flattenRecordHistory(data)}
        uiSpec={uiSpec}
        rootRecordId={recordId}
        notebook={notebook}
      />
    </Box>
  );
}
