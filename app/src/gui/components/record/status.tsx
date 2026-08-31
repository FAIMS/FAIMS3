/**
 * Status tree for a record and its child records: the recursive completion
 * roll-up from computeRecordStatusReport, rendered as nested nodes.
 *
 * The app is offline-first, so the report is computed against the local data
 * database through the page's DataEngine, not fetched from the api.
 */
import {
  CompiledNotebookUiSpec,
  computeRecordStatusReport,
  DataEngine,
  getFieldLabel,
  getFormLabel,
  ProjectID,
  RecordID,
  RecordStatusReport,
} from '@faims3/data-model';
import {fieldCompletionResolver, ProgressBar} from '@faims3/forms';
import {Box, CircularProgress, Link, Stack, Typography} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import React from 'react';
import {Link as RouterLink} from 'react-router-dom';
import {
  getViewRecordRoute,
  RecordRouteNotebook,
} from '../../../constants/routes';
import {buildStatusReportKey} from '../../../utils/customHooks';
import {getDisplayDataFromRecordMetadata} from '../../../utils/formUtilities';

interface RecordStatusProps {
  /** The notebook tab this page sits under, which the child links stay on. */
  notebook: RecordRouteNotebook;
  recordId: RecordID;
  projectId: ProjectID;
  dataEngine: DataEngine;
  isDeleted: boolean;
}

/**
 * One node of the tree: the record's roll-up progress, its own required-field
 * count, then each child field with its child records nested underneath.
 */
const StatusNode: React.FC<{
  report: RecordStatusReport;
  uiSpec: CompiledNotebookUiSpec;
  notebook: RecordRouteNotebook;
  /** The viewed record itself, which needs no link to where the user already is. */
  isRoot?: boolean;
}> = ({report, uiSpec, notebook, isRoot}) => {
  const {ownProgress} = report;
  const summaryFieldIds = Object.keys(report.summaryValues);

  return (
    <Stack spacing={1}>
      <Stack
        direction="row"
        spacing={1}
        sx={{alignItems: 'baseline', flexWrap: 'wrap'}}
      >
        <Typography variant="subtitle1">
          {getFormLabel({uiSpec, formId: report.formId})}
        </Typography>
        {isRoot ? (
          <Typography variant="body2" color="textSecondary">
            {report.hrid}
          </Typography>
        ) : (
          <Link
            component={RouterLink}
            to={getViewRecordRoute({
              ...notebook,
              recordId: report.recordId,
            })}
            variant="body2"
          >
            {report.hrid}
          </Link>
        )}
      </Stack>

      {/* Green at 100% so finished branches read at a glance; amber marks the gaps */}
      <ProgressBar
        completion={report.progress}
        colorByCompletion
        barStyle={{height: '16px'}}
      />
      <Typography variant="caption" color="textSecondary">
        {ownProgress.requiredCount === 0
          ? 'No required fields on this record'
          : `${ownProgress.completedCount}/${ownProgress.requiredCount} required fields on this record`}
      </Typography>

      {summaryFieldIds.length > 0 && (
        <Typography variant="body2" sx={{overflowWrap: 'anywhere'}}>
          {summaryFieldIds
            .map(
              fieldId =>
                `${getFieldLabel(uiSpec, fieldId)}: ${getDisplayDataFromRecordMetadata(
                  {field: fieldId, data: report.summaryValues}
                )}`
            )
            .join(' · ')}
        </Typography>
      )}

      {report.childFields.map(field => {
        const childFormLabel = getFormLabel({
          uiSpec,
          formId: field.relatedFormId,
        });
        return (
          <Box
            key={field.fieldId}
            sx={{pl: 2, borderLeft: 1, borderColor: 'divider'}}
          >
            <Typography
              variant="body2"
              // A required field with no children is what holds the roll-up back
              color={
                field.children.length > 0
                  ? 'textPrimary'
                  : field.required
                    ? 'warning'
                    : 'textSecondary'
              }
            >
              {getFieldLabel(uiSpec, field.fieldId)}:{' '}
              {field.children.length === 0
                ? `no ${childFormLabel} records yet${field.required ? ' (required)' : ''}`
                : `${field.children.length} ${childFormLabel} record${field.children.length === 1 ? '' : 's'}`}
            </Typography>
            <Stack spacing={2} sx={{pt: 1}}>
              {field.children.map(child => (
                <StatusNode
                  key={child.recordId}
                  report={child}
                  uiSpec={uiSpec}
                  notebook={notebook}
                />
              ))}
            </Stack>
          </Box>
        );
      })}
    </Stack>
  );
};

/**
 * Content for the Status tab: completion of the viewed record rolled up over
 * its whole child-record tree, computed from the local data database. The
 * report always walks current heads, so it ignores the page's ?revisionId.
 */
export const RecordStatus: React.FC<RecordStatusProps> = ({
  notebook,
  recordId,
  projectId,
  dataEngine,
  isDeleted,
}) => {
  const {
    data: report,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: buildStatusReportKey({projectId, recordId}),
    queryFn: () =>
      computeRecordStatusReport({
        engine: dataEngine,
        recordId,
        projectId,
        // Same per-field scoring as the form's progress bar; the walk also
        // checks child liveness, so the two can differ after a child delete
        isCompleteResolver: fieldCompletionResolver,
      }),
    // A deleted root has no report to compute
    enabled: !isDeleted,
    networkMode: 'always',
    // The tree can change under this record while the page is open
    refetchOnMount: 'always',
  });

  if (isDeleted) {
    return (
      <Typography>
        This record has been deleted, so it has no status to report.
      </Typography>
    );
  }

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
          An error occurred while computing the record status. Error:{' '}
          {error?.message ?? 'unknown'}.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Typography variant="h5">Status</Typography>
        <Typography variant="subtitle1">
          Completion of this record and every record below it.
        </Typography>
      </Stack>
      <StatusNode
        report={report}
        uiSpec={dataEngine.uiSpec}
        notebook={notebook}
        isRoot
      />
    </Stack>
  );
};
