import {fetchAndHydrateRecord} from '@faims3/data-model';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  CircularProgress,
  Paper,
  Typography,
} from '@mui/material';
import {useQueries} from '@tanstack/react-query';
import {useState} from 'react';
import {z} from 'zod';
import {localGetDataDb} from '../../../..';
import {FormRenderer, FormRendererProps} from '../../engine';
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
  recordId: string;
}

const RelatedRecordTitle = ({
  recordLabel,
  recordId,
}: RelatedRecordTitleProps) => (
  <Box sx={{width: '100%', pr: 2}}>
    <Typography variant="subtitle1" sx={{fontWeight: 500}}>
      {recordLabel}
    </Typography>
    <Typography
      variant="caption"
      sx={{color: 'text.disabled', display: 'block'}}
    >
      ID: {recordId}
    </Typography>
  </Box>
);

// Component for individual related record
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
  index,
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
          recordId={recordInfo.record_id}
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
  const uiSpec = props.rendererContext.uiSpecification;
  const dataDb = localGetDataDb(projectId);

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
        // TODO manage circular dependencies by context tracking the path
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
        } satisfies FormRendererProps;
      },
      queryKey: ['related-hydration', relId],
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

          {relatedRecordDetails.map((related, index) => (
            <RelatedRecordItem
              key={relatedRecords[index].record_id}
              recordInfo={relatedRecords[index]}
              formRendererProps={related.data}
              isLoading={related.isLoading}
              index={index}
            />
          ))}
        </>
      ) : (
        <EmptyState />
      )}
    </Box>
  );
};
