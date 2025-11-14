import {fetchAndHydrateRecord, getDataDB} from '@faims3/data-model';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  CircularProgress,
  Link,
  Paper,
  Typography,
} from '@mui/material';
import {useQueries} from '@tanstack/react-query';
import {useState} from 'react';
import z from 'zod';
import {getExistingRecordRoute} from '../../../../../constants/routes';
import {DataView, DataViewProps, DataViewTrace} from '../../../DataView';
import {DataViewFieldRender} from '../../../types';
import {EmptyResponsePlaceholder, TextWrapper} from '../wrappers';

// ============================================================================
// Type Definitions & Schemas
// ============================================================================

/**
 * Schema for a single record reference containing project and record identifiers
 */
const RecordReferenceSchema = z.object({
  project_id: z.string(),
  record_id: z.string(),
  record_label: z.string(),
  relation_type_vocabPair: z.array(z.string()).optional(),
});

/**
 * Schema for an array of record references
 */
const RecordReferenceArraySchema = z.array(RecordReferenceSchema);

/**
 * Inferred TypeScript type for a single record reference
 */
type RecordReference = z.infer<typeof RecordReferenceSchema>;

/**
 * Display behavior for related records based on nesting depth
 */
type DisplayBehavior = 'nest' | 'link';

/**
 * Props for components that display related record information
 */
interface RelatedRecordDisplayProps {
  recordLabel: string;
  recordId: string;
  serverId: string;
  projectId: string;
}

/**
 * Props for the nested accordion view of a related record
 */
interface NestedRecordProps {
  recordInfo: RecordReference;
  formRendererProps?: DataViewProps;
  isLoading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Maximum nesting depth for related records renderer. E.g. 2 means two "parents".
 */
export const RENDER_NEST_LIMIT = 2;

/**
 * Error message displayed when record references are invalid
 */
const INVALID_REFERENCES_MESSAGE =
  'Invalid references. Contact an administrator.';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Determines whether to nest or link related records based on current depth
 *
 * @param trace - The renderer trace history showing parent chain
 * @returns 'nest' if within limit, 'link' if at or beyond limit
 *
 */
function determineBehaviorFromTrace(trace: DataViewTrace[]): DisplayBehavior {
  return trace.length >= RENDER_NEST_LIMIT ? 'link' : 'nest';
}

// ============================================================================
// UI Components
// ============================================================================

/**
 * Loading indicator for async record fetching
 */
const LoadingPlaceholder = () => (
  <Box sx={{display: 'flex', justifyContent: 'center', p: 3}}>
    <CircularProgress size={24} />
  </Box>
);

/**
 * Empty state component when no related records exist
 */
const EmptyState = () => <EmptyResponsePlaceholder />;

/**
 * Title display for related record items
 */
const RelatedRecordTitle = ({recordLabel}: {recordLabel: string}) => (
  <Box sx={{width: '100%', pr: 2}}>
    <Typography variant="subtitle1" sx={{fontWeight: 500}}>
      {recordLabel}
    </Typography>
  </Box>
);

/**
 * Section header showing count of related records
 */
const RelatedRecordsHeader = ({count}: {count: number}) => (
  <Typography
    variant="h6"
    sx={{
      mb: 2,
      color: 'text.secondary',
      fontWeight: 500,
      fontSize: '1rem',
    }}
  >
    Related Records ({count})
  </Typography>
);

/**
 * Error message for records that failed to load
 */
const RecordLoadError = () => (
  <Typography color="error" variant="body2">
    Unable to load related record
  </Typography>
);

// ============================================================================
// Related Record Display Components
// ============================================================================

/**
 * Displays a related record as a clickable link (used when nesting limit exceeded)
 *
 * Shows record information with a link to view the full record in a new context.
 * Used when RENDER_NEST_LIMIT is reached to prevent infinite nesting.
 */
const LinkedRecordItem = ({
  recordLabel,
  recordId,
  serverId,
  projectId,
}: RelatedRecordDisplayProps) => {
  const recordRoute = getExistingRecordRoute({
    serverId,
    projectId,
    recordId,
  });

  return (
    <Paper
      elevation={1}
      sx={{
        mb: 2,
        p: 2,
        bgcolor: '#f5f5f5',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        '&:hover': {
          bgcolor: '#eeeeee',
        },
      }}
    >
      <Box sx={{flex: 1}}>
        <RelatedRecordTitle recordLabel={recordLabel} />
      </Box>
      <Link
        href={recordRoute}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          textDecoration: 'none',
          color: 'primary.main',
          '&:hover': {
            textDecoration: 'underline',
          },
        }}
      >
        View Record
        <OpenInNewIcon sx={{fontSize: 16}} />
      </Link>
    </Paper>
  );
};

/**
 * Displays a related record as an expandable accordion with nested content
 *
 * Renders the full record content inline using FormRenderer when expanded.
 * Used when within the RENDER_NEST_LIMIT to show hierarchical relationships.
 */
const NestedRecordItem = ({
  recordInfo,
  formRendererProps,
  isLoading,
}: NestedRecordProps) => {
  const [expanded, setExpanded] = useState(false);

  const displayLabel =
    formRendererProps?.hydratedRecord.hrid ?? recordInfo.record_id;

  return (
    <Accordion
      expanded={expanded}
      onChange={() => setExpanded(!expanded)}
      sx={{
        mb: 2,
        '&:before': {display: 'none'},
        boxShadow: 1,
        '&.Mui-expanded': {
          margin: '0 0 16px 0',
        },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          bgcolor: '#f5f5f5',
          borderBottom: '1px solid',
          borderColor: 'divider',
          borderRadius: expanded ? '4px 4px 0 0' : '4px',
          '&:hover': {
            bgcolor: '#eeeeee',
          },
          '& .MuiAccordionSummary-content': {
            my: 1.5,
          },
        }}
      >
        <RelatedRecordTitle recordLabel={displayLabel} />
      </AccordionSummary>
      <AccordionDetails
        sx={{
          p: 0,
          bgcolor: '#fafafa',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            m: 2,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: '#e0e0e0',
            borderRadius: 1,
          }}
        >
          {isLoading ? (
            <LoadingPlaceholder />
          ) : formRendererProps ? (
            <DataView {...formRendererProps} />
          ) : (
            <RecordLoadError />
          )}
        </Paper>
      </AccordionDetails>
    </Accordion>
  );
};

/**
 * Wrapper for loading state of a single related record
 */
const LoadingRecordItem = ({recordId}: {recordId: string}) => (
  <Paper key={recordId} sx={{mb: 2}}>
    <LoadingPlaceholder />
  </Paper>
);

/**
 * Wrapper for error state of a single related record
 */
const ErrorRecordItem = ({recordId}: {recordId: string}) => (
  <Paper key={recordId} sx={{mb: 2, p: 2}}>
    <RecordLoadError />
  </Paper>
);

// ============================================================================
// Main Component
// ============================================================================

/**
 * Renders related records for a given field value
 *
 * This component handles displaying records that are related to the current record.
 * It supports two display modes:
 * - **Nested**: Shows related records inline with expandable accordions
 * - **Linked**: Shows related records as links when nesting limit is reached
 *
 * The component:
 * 1. Validates the input value against the expected schema
 * 2. Fetches and hydrates each related record
 * 3. Determines display behavior based on nesting depth
 * 4. Renders either nested accordions or link cards accordingly
 *
 * @param props - RenderFunctionComponent props containing value and context
 * @returns JSX for displaying related records or appropriate fallback
 */
export const RelatedRecordRenderer: DataViewFieldRender = props => {
  const {recordMetadata, uiSpecification, trace, fieldId, viewId, viewsetId} =
    props.renderContext;
  const {project_id: projectId} = recordMetadata;

  // Initialize data access
  const behavior = determineBehaviorFromTrace(trace);

  // Validate and parse input value
  const parseResult = RecordReferenceArraySchema.safeParse(props.value);
  if (!parseResult.success) {
    return <TextWrapper content={INVALID_REFERENCES_MESSAGE} />;
  }

  const relatedRecords = parseResult.data;

  // Fetch and hydrate all related records
  const relatedRecordQueries = useQueries({
    queries: relatedRecords.map(({record_id}) => ({
      queryKey: ['related-hydration', record_id, behavior],
      queryFn: async () => {
        const dataDb = await getDataDB(projectId);
        if (!dataDb) {
          return undefined;
        }
        const hydratedRecord = await fetchAndHydrateRecord({
          projectId,
          dataDb,
          recordId: record_id,
          uiSpecification,
        });

        if (!hydratedRecord) {
          return undefined;
        }

        // Return full renderer props for nested mode
        return {
          viewsetId: hydratedRecord.type,
          uiSpecification,
          hydratedRecord,
          config: props.config,
          trace: [
            ...trace,
            {
              callType: 'relatedRecord' as const,
              fieldId,
              recordId: recordMetadata.record_id,
              viewId,
              viewsetId,
            },
          ],
        } satisfies DataViewProps;
      },
      networkMode: 'always' as const,
    })),
  });

  // Handle empty state
  if (relatedRecordQueries.length === 0) {
    return <EmptyState />;
  }

  // Render related records list
  return (
    <Box sx={{mt: 2, mb: 2}}>
      <RelatedRecordsHeader count={relatedRecordQueries.length} />

      {relatedRecordQueries.map((query, index) => {
        const recordInfo = relatedRecords[index];
        const key = recordInfo.record_id;

        // Handle loading state
        if (query.isLoading) {
          return <LoadingRecordItem key={key} recordId={key} />;
        }

        // Handle error state
        if (!query.data) {
          return <ErrorRecordItem key={key} recordId={key} />;
        }

        const {hydratedRecord} = query.data;

        // Render link mode
        if (behavior === 'link') {
          return (
            <LinkedRecordItem
              key={key}
              recordLabel={hydratedRecord.hrid ?? recordInfo.record_id}
              recordId={recordInfo.record_id}
              serverId={projectId}
              projectId={projectId}
            />
          );
        }

        // Render nested mode
        return (
          <NestedRecordItem
            key={key}
            recordInfo={recordInfo}
            formRendererProps={query.data}
            isLoading={false}
          />
        );
      })}
    </Box>
  );
};
