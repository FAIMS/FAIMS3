import {fetchAndHydrateRecord} from '@faims3/data-model';
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
import {z} from 'zod';
import {localGetDataDb} from '../../../..';
import {getExistingRecordRoute} from '../../../../constants/routes';
import {FormRenderer, FormRendererProps, FormRendererTrace} from '../../engine';
import {RenderFunctionComponent} from '../../types';
import {EmptyResponsePlaceholder, TextWrapper} from '../wrappers';

// Define the Zod schema
const RecordReferenceSchema = z.object({
  project_id: z.string(),
  record_id: z.string(),
  record_label: z.string(),
  relation_type_vocabPair: z.array(z.string()).optional(),
});
const RecordReferenceArraySchema = z.array(RecordReferenceSchema);

// NOTE: you can change this to determine how many nestings can occur - e.g. 2
// means you can have 3 total renderers (in one chain)
export const RENDER_NEST_LIMIT = 0;

/**
 * Determines the appropriate related records nesting behaviour based on depth
 * @param trace The trace history
 * @returns Behaviour for nesting
 */
function determineBehaviourFromTrace(
  trace: FormRendererTrace[]
): 'nest' | 'link' {
  // The trace refers to the number of parent entities - so if we have 1 parent, we have nested once
  if (trace.length >= RENDER_NEST_LIMIT) {
    return 'link';
  } else {
    return 'nest';
  }
}

// Component for loading state
const LoadingPlaceholder = () => (
  <Box sx={{display: 'flex', justifyContent: 'center', p: 3}}>
    <CircularProgress size={24} />
  </Box>
);

// Component for empty state
const EmptyState = () => <EmptyResponsePlaceholder />;

// Component for accordion title
interface RelatedRecordTitleProps {
  recordLabel: string;
}

const RelatedRecordTitle = ({recordLabel}: RelatedRecordTitleProps) => (
  <Box sx={{width: '100%', pr: 2}}>
    <Typography variant="subtitle1" sx={{fontWeight: 500}}>
      {recordLabel}
    </Typography>
  </Box>
);

// Component for linked record (when nesting limit exceeded)
interface LinkedRecordItemProps {
  recordInfo: z.infer<typeof RecordReferenceSchema>;
  recordLabel: string;
  recordId: string;
  revisionId: string;
  serverId: string;
  projectId: string;
}

const LinkedRecordItem = ({
  recordLabel,
  recordId,
  revisionId,
  serverId,
  projectId,
}: LinkedRecordItemProps) => {
  const recordRoute = getExistingRecordRoute({
    serverId,
    projectId,
    recordId,
    revisionId,
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

// Component for individual related record (nested view)
interface RelatedRecordItemProps {
  recordInfo: z.infer<typeof RecordReferenceSchema>;
  formRendererProps?: FormRendererProps;
  isLoading: boolean;
  index: number;
}

const RelatedRecordItem = ({
  recordInfo,
  formRendererProps,
  isLoading,
}: RelatedRecordItemProps) => {
  const [expanded, setExpanded] = useState(false);

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
        <RelatedRecordTitle
          recordLabel={
            formRendererProps?.hydratedRecord.hrid ?? recordInfo.record_id
          }
        />
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
            <FormRenderer {...formRendererProps} />
          ) : (
            <Typography color="error" variant="body2">
              Unable to load related record
            </Typography>
          )}
        </Paper>
      </AccordionDetails>
    </Accordion>
  );
};

// Main component
export const RelatedRecordRenderer: RenderFunctionComponent = props => {
  const projectId = props.rendererContext.recordMetadata.project_id;
  const serverId = props.rendererContext.recordMetadata.project_id; // Assuming serverId is same as projectId or available in metadata
  const uiSpec = props.rendererContext.uiSpecification;
  const dataDb = localGetDataDb(projectId);

  // Determine behavior based on trace depth
  const behaviour = determineBehaviourFromTrace(props.rendererContext.trace);

  // Parse with Zod
  const parseResult = RecordReferenceArraySchema.safeParse(props.value);
  const fallbackText = 'Invalid references. Contact an administrator.';

  if (!parseResult.success) {
    return <TextWrapper content={fallbackText} />;
  }

  const relatedRecords = parseResult.data;
  const relatedRecordInfo = relatedRecords.map(r => r.record_id);

  // For each related record, go and fetch a bunch of stuff
  const relatedRecordDetails = useQueries({
    queries: relatedRecordInfo.map(relId => ({
      queryFn: async () => {
        // Grab and hydrate the record
        const hydrated = await fetchAndHydrateRecord({
          projectId: props.rendererContext.recordMetadata.project_id,
          dataDb,
          recordId: relId,
          uiSpecification: uiSpec,
        });
        if (!hydrated) {
          return undefined;
        }

        // If we're in link mode, return minimal data needed for link
        if (behaviour === 'link') {
          return {
            hydratedRecord: hydrated,
            isLink: true,
          };
        }

        // Otherwise, prepare full renderer props for nesting
        return {
          viewsetId: hydrated.type,
          uiSpecification: uiSpec,
          hydratedRecord: hydrated,
          config: props.config,
          trace: [
            ...props.rendererContext.trace,
            {
              callType: 'relatedRecord',
              fieldId: props.rendererContext.fieldId,
              recordId: props.rendererContext.recordMetadata.record_id,
              viewId: props.rendererContext.viewId,
              viewsetId: props.rendererContext.viewsetId,
            },
          ],
          isLink: false,
        } satisfies FormRendererProps & {isLink: boolean};
      },
      queryKey: ['related-hydration', relId, behaviour],
      networkMode: 'always',
    })),
  });

  return (
    <Box sx={{mt: 2, mb: 2}}>
      {relatedRecordDetails.length > 0 ? (
        <>
          <Typography
            variant="h6"
            sx={{
              mb: 2,
              color: 'text.secondary',
              fontWeight: 500,
              fontSize: '1rem',
            }}
          >
            Related Records ({relatedRecordDetails.length})
          </Typography>

          {relatedRecordDetails.map((related, index) => {
            if (related.isLoading) {
              return (
                <Paper key={relatedRecords[index].record_id} sx={{mb: 2}}>
                  <LoadingPlaceholder />
                </Paper>
              );
            }

            if (!related.data) {
              return (
                <Paper key={relatedRecords[index].record_id} sx={{mb: 2, p: 2}}>
                  <Typography color="error" variant="body2">
                    Unable to load related record
                  </Typography>
                </Paper>
              );
            }

            // Render as link if behaviour is 'link'
            if (behaviour === 'link' && related.data.isLink) {
              const hydrated = related.data.hydratedRecord;
              return (
                <LinkedRecordItem
                  key={relatedRecords[index].record_id}
                  recordInfo={relatedRecords[index]}
                  recordLabel={hydrated.hrid ?? relatedRecords[index].record_id}
                  recordId={relatedRecords[index].record_id}
                  revisionId={hydrated.revision_id}
                  serverId={serverId}
                  projectId={projectId}
                />
              );
            }

            // Otherwise render nested accordion
            return (
              <RelatedRecordItem
                key={relatedRecords[index].record_id}
                recordInfo={relatedRecords[index]}
                formRendererProps={related.data as FormRendererProps}
                isLoading={false}
                index={index}
              />
            );
          })}
        </>
      ) : (
        <EmptyState />
      )}
    </Box>
  );
};
