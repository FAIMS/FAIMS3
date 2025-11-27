import {HydratedRecord} from '@faims3/data-model';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LinkIcon from '@mui/icons-material/Link';
import {
  Alert,
  Button,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
  Tooltip,
  Typography,
} from '@mui/material';
import {useMutation, useQueries, UseQueryResult} from '@tanstack/react-query';
import {useMemo} from 'react';
import z from 'zod';
import {FullFormManagerConfig} from '../../../formModule';
import {
  BaseFieldProps,
  BaseFieldPropsSchema,
  FormFieldContextProps,
} from '../../../formModule/types';
import {FieldInfo} from '../../types';
import FieldWrapper from '../wrappers/FieldWrapper';

// ============================================================================
// Component Specific Types & Schemas
// ============================================================================

const relatedRecordPropsSchema = BaseFieldPropsSchema.extend({
  related_type: z.string(),
  relation_type: z.enum(['faims-core::Child', 'faims-core::Linked']),
  multiple: z.boolean().optional().default(false),
  allowLinkToExisting: z.boolean().optional().default(false),
});

type RelatedRecordFieldProps = z.infer<typeof relatedRecordPropsSchema>;
type RelatedRecordProps = RelatedRecordFieldProps & FormFieldContextProps;

interface FullRelatedRecordFieldProps extends RelatedRecordProps {
  config: FullFormManagerConfig;
}

const fieldValueEntrySchema = z.object({
  record_id: z.string(),
  project_id: z.string().optional(),
  relation_type_vocabPair: z.tuple([z.string(), z.string()]),
});

const fieldValueSchema = z.union([
  z.array(fieldValueEntrySchema),
  fieldValueEntrySchema,
]);
type FieldValue = z.infer<typeof fieldValueSchema>;
type FieldValueEntry = z.infer<typeof fieldValueEntrySchema>;

// ============================================================================
// Utility Functions
// ============================================================================

function relationTypeToPair(
  type: 'faims-core::Child' | 'faims-core::Linked'
): [string, string] {
  if (type === 'faims-core::Child') {
    return ['has child', 'is child of'];
  } else {
    return ['is linked to', 'is linked from'];
  }
}

// ============================================================================
// UI Components
// ============================================================================

interface RelatedRecordListItemProps {
  link: FieldValueEntry;
  queryResult: UseQueryResult<HydratedRecord | undefined, Error>;
  onNavigate: (recordId: string) => void;
}

const RelatedRecordListItem = ({
  link,
  queryResult,
  onNavigate,
}: RelatedRecordListItemProps) => {
  const {data, isLoading, isError, error} = queryResult;

  // 1. Loading State - skeletons
  if (isLoading) {
    return (
      <ListItem disablePadding divider>
        <ListItemButton disabled>
          <ListItemIcon sx={{minWidth: 40}}>
            <CircularProgress size={20} />
          </ListItemIcon>
          <ListItemText
            primary={<Skeleton animation="wave" height={20} width="60%" />}
            secondary={<Skeleton animation="wave" height={16} width="40%" />}
          />
        </ListItemButton>
      </ListItem>
    );
  }

  // 2. Error State: Show ID and Error Icon
  if (isError || !data) {
    const errorMessage = error instanceof Error ? error.message : 'Load failed';
    return (
      <ListItem disablePadding divider>
        <ListItemButton onClick={() => onNavigate(link.record_id)}>
          <ListItemIcon sx={{minWidth: 40}}>
            <Tooltip title={`Error: ${errorMessage}`}>
              <ErrorOutlineIcon color="error" fontSize="small" />
            </Tooltip>
          </ListItemIcon>
          <ListItemText
            primary={link.record_id}
            secondary={link.relation_type_vocabPair[0] + ' (Load Error)'}
            primaryTypographyProps={{
              variant: 'body2',
              fontFamily: 'monospace',
              color: 'error',
            }}
          />
        </ListItemButton>
      </ListItem>
    );
  }

  // 3. Success State: Hydrated Data
  return (
    <ListItem disablePadding divider>
      <ListItemButton
        onClick={() => onNavigate(link.record_id)}
        title="Click to view record"
      >
        <ListItemIcon sx={{minWidth: 40}}>
          <LinkIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={data.hrid}
          secondary={link.relation_type_vocabPair[0]}
          primaryTypographyProps={{
            variant: 'body2',
            fontFamily: 'monospace',
            fontWeight: data.hrid !== link.record_id ? 'bold' : 'normal',
          }}
        />
      </ListItemButton>
    </ListItem>
  );
};

const FullRelatedRecordField = (props: FullRelatedRecordFieldProps) => {
  const rawValue = props.state.value?.data || undefined;

  const value = useMemo(
    () => fieldValueSchema.safeParse(rawValue).data,
    [rawValue]
  );

  const normalizedLinks = useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  const {mutate, isPending, isError, error} = useMutation({
    mutationFn: async () => {
      const res = await props.config.dataEngine().form.createRecord({
        createdBy: props.config.user,
        formId: props.related_type,
        relationship: {
          parent: {
            fieldId: props.fieldId,
            recordId: props.config.recordId,
            relationTypeVocabPair: relationTypeToPair(props.relation_type),
          },
        },
      });

      props.setFieldData([
        ...normalizedLinks,
        {
          record_id: res.record._id,
          relation_type_vocabPair: relationTypeToPair(props.relation_type),
        },
      ] satisfies FieldValue);

      await props.config.trigger.commit();
      return res;
    },
    mutationKey: [
      'create-related-record',
      props.fieldId,
      props.config.recordId,
    ],
    onSuccess: res => {
      props.config.redirect.toRecord({recordId: res.record._id, mode: 'new'});
    },
    networkMode: 'always',
    gcTime: 0,
  });

  // Fetch and hydrate all related records
  const relatedRecordQueries = useQueries({
    queries: normalizedLinks.map(({record_id}) => ({
      queryKey: ['related-hydration', record_id],
      queryFn: async () => {
        const record = await props.config
          .dataEngine()
          .hydrated.getHydratedRecord({
            recordId: record_id,
            config: {conflictBehaviour: 'pickLast'},
          });

        // Ensure strict type compliance by casting or checking if necessary
        // Assuming the data engine returns a compatible HydratedRecord
        return record ?? undefined;
      },
      networkMode: 'always',
      staleTime: 0,
      refetchOnMount: 'always',
    })),
  });

  const handleLinkClick = (recordId: string) => {
    props.config.redirect.toRecord({recordId: recordId, mode: 'parent'});
  };

  return (
    <>
      {/* Error Alert for Creation */}
      {isError && (
        <Alert severity="error" sx={{mb: 2}}>
          {error instanceof Error
            ? error.message
            : 'An error occurred creating the record'}
        </Alert>
      )}

      {/* Action Buttons */}
      <Button
        variant="outlined"
        size="small"
        sx={{mb: 2}}
        onClick={() => mutate()}
        disabled={isPending}
        startIcon={
          isPending ? <CircularProgress size={20} color="inherit" /> : null
        }
      >
        {isPending ? 'Creating...' : 'Link New Record'}
      </Button>

      {/* Linked Records List */}
      {normalizedLinks.length > 0 ? (
        <Paper variant="outlined">
          <List dense disablePadding>
            {normalizedLinks.map((link, index) => (
              <RelatedRecordListItem
                key={link.record_id}
                link={link}
                queryResult={relatedRecordQueries[index]}
                onNavigate={handleLinkClick}
              />
            ))}
          </List>
        </Paper>
      ) : (
        <Typography variant="caption" display="block" color="text.secondary">
          No records linked.
        </Typography>
      )}
    </>
  );
};

const RelatedRecordField = (props: BaseFieldProps & FormFieldContextProps) => {
  if (props.config.mode === 'preview') {
    return (
      <Typography variant="body2">Related Record Selector (Preview)</Typography>
    );
  } else {
    return (
      <FieldWrapper
        heading={props.label}
        required={props.required}
        advancedHelperText={props.advancedHelperText}
        errors={props.state.meta.errors as unknown as string[]}
      >
        <FullRelatedRecordField {...(props as FullRelatedRecordFieldProps)} />
      </FieldWrapper>
    );
  }
};

// generate a zod schema for the value.
const valueSchemaFunction = (props: RelatedRecordFieldProps) => {
  // 1. If required is true
  if (props.required) {
    return fieldValueSchema.refine(
      val => {
        // If it is an array, ensure it has at least one item
        if (Array.isArray(val)) {
          return val.length > 0;
        }
        // If it is a single object (and matches the schema), it is valid
        return !!val;
      },
      {message: 'At least one related record is required.'}
    );
  }

  // 2. If required is false
  // Allow null, undefined, or valid schema (including empty array)
  return fieldValueSchema.optional().nullable();
};

export const relatedRecordFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'RelatedRecordSelector',
  returns: 'faims-core::Relationship',
  component: RelatedRecordField,
  fieldPropsSchema: relatedRecordPropsSchema,
  fieldDataSchemaFunction: valueSchemaFunction,
};
