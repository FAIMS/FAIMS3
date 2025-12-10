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
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {useQueries} from '@tanstack/react-query';
import {useState} from 'react';
import z from 'zod';
import {
  DataViewFieldRender,
  DataViewProps,
  DataViewTools,
  DataViewTraceEntry,
} from '../../../types';
import {EmptyResponsePlaceholder, TextWrapper} from '../wrappers';
import {DataView} from '../../../DataView';

// ============================================================================
// Type Definitions & Schemas
// ============================================================================

/**
 * Schema for a single record reference containing project and record identifiers
 */
const RecordReferenceSchema = z.object({
  project_id: z.string().optional(),
  record_id: z.string(),
  record_label: z.string().optional(),
  relation_type_vocabPair: z.array(z.string()).optional(),
});

/**
 * Schema for an array of record references
 */
const RecordReferenceArraySchema = z.array(RecordReferenceSchema);

/**
 * Schema that accepts either a single record reference or an array of them
 */
const RecordReferenceInputSchema = z.union([
  RecordReferenceSchema,
  RecordReferenceArraySchema,
]);

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
  tools: DataViewTools;
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
function determineBehaviorFromTrace(
  trace: DataViewTraceEntry[]
): DisplayBehavior {
  //return 'link';
  return trace.length >= RENDER_NEST_LIMIT ? 'link' : 'nest';
}

/**
 * Normalizes the input value to always be an array of record references
 *
 * @param value - Either a single record reference or an array of them
 * @returns An array of record references, or null if validation fails
 */
function normalizeRecordReferences(value: unknown): RecordReference[] | null {
  const parseResult = RecordReferenceInputSchema.safeParse(value);
  if (!parseResult.success) {
    return null;
  }

  // Normalize to array format
  const parsed = parseResult.data;
  return Array.isArray(parsed) ? parsed : [parsed];
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
  tools,
}: RelatedRecordDisplayProps) => {
  const recordRoute = tools.getRecordRoute({
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [expanded, setExpanded] = useState(false);
  const displayLabel = formRendererProps?.hrid ?? recordInfo.record_id;
  const EditButton = formRendererProps?.tools.editRecordButtonComponent;

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
        <Stack
          direction={isMobile ? 'column' : 'row'}
          alignItems={isMobile ? 'flex-start' : 'center'}
          justifyContent="flex-start"
          spacing={2}
          sx={{width: '100%'}}
        >
          {EditButton && (
            <Box
              onClick={e => e.stopPropagation()}
              onFocus={e => e.stopPropagation()}
              sx={{flexShrink: 0}}
            >
              <EditButton recordId={recordInfo.record_id} />
            </Box>
          )}
          <Box sx={{flex: 1, minWidth: 0}}>
            <RelatedRecordTitle recordLabel={displayLabel} />
          </Box>
        </Stack>
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
 * 1. Validates the input value against the expected schema (supports both
 *    singleton and array inputs, normalizing to array format)
 * 2. Fetches and hydrates each related record
 * 3. Determines display behavior based on nesting depth
 * 4. Renders either nested accordions or link cards accordingly
 *
 * @param props - RenderFunctionComponent props containing value and context
 * @returns JSX for displaying related records or appropriate fallback
 */
export const RelatedRecordRenderer: DataViewFieldRender = props => {
  const {record, uiSpecification, trace, fieldId, viewId, viewsetId} =
    props.renderContext;

  // Initialize data access
  const behavior = determineBehaviorFromTrace(trace);

  // Validate and normalize input value (handles both singleton and array)
  const relatedRecords = normalizeRecordReferences(props.value);
  if (relatedRecords === null) {
    return <TextWrapper content={INVALID_REFERENCES_MESSAGE} />;
  }

  // Fetch and hydrate all related records
  const relatedRecordQueries = useQueries({
    queries:
      behavior === 'nest'
        ? relatedRecords.map(({record_id}) => ({
            queryKey: ['related-hydration', record_id, behavior],
            queryFn: async () => {
              const engine = props.renderContext.tools.getDataEngine();

              const hydratedRecord = await engine.form.getExistingFormData({
                recordId: record_id,
              });

              if (!hydratedRecord) {
                return undefined;
              }

              // Return full renderer props for nested mode
              return {
                viewsetId: hydratedRecord.formId,
                formData: hydratedRecord.data,
                hydratedRecord: hydratedRecord.context.record,
                hrid: hydratedRecord.context.hrid,
                trace: [
                  ...trace,
                  {
                    callType: 'relatedRecord' as const,
                    fieldId,
                    recordId: record._id,
                    viewId,
                    viewsetId,
                  },
                ],
                uiSpecification,
                config: props.config,
                tools: props.renderContext.tools,
              } satisfies DataViewProps;
            },
            networkMode: 'always' as const,
          }))
        : [],
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

        // Render link mode
        if (behavior === 'link') {
          return (
            <LinkedRecordItem
              key={key}
              recordLabel={query.data.hrid ?? recordInfo.record_id}
              recordId={recordInfo.record_id}
              tools={props.renderContext.tools}
            />
          );
        }

        // Render nested mode
        return (
          <NestedRecordItem
            key={key}
            recordInfo={recordInfo}
            formRendererProps={query.data}
            isLoading={query.isPending}
          />
        );
      })}
    </Box>
  );
};
