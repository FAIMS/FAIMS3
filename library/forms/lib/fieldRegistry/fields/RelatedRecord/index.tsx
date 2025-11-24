import LinkIcon from '@mui/icons-material/Link';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from '@mui/material';
import {useMutation, useQueries} from '@tanstack/react-query';
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
import {prependOnceListener} from 'process';

// ============================================================================
// Types & Schema
// ============================================================================

const relatedRecordPropsSchema = BaseFieldPropsSchema.extend({
  // 'FormId' of the child/related record
  related_type: z.string(),
  // Relation type - either 'Child' or 'Linked'
  relation_type: z.enum(['faims-core::Child', 'faims-core::Linked']),
  // Allow selection of multiple related records
  multiple: z.boolean().optional().default(false),
  // Can you link to existing records, or only create new ones
  allowLinkToExisting: z.boolean().optional().default(false),
});

type RelatedRecordFieldProps = z.infer<typeof relatedRecordPropsSchema>;
type RelatedRecordProps = RelatedRecordFieldProps & FormFieldContextProps;

interface FullRelatedRecordFieldProps extends RelatedRecordProps {
  config: FullFormManagerConfig;
}

const fieldValueEntrySchema = z.object({
  // ID of the linked record
  record_id: z.string(),
  // ID of the project
  project_id: z.string().optional(),
  relation_type_vocabPair: z.tuple([z.string(), z.string()]),
});

// can be a list, or single entry - new entries will be list only
const fieldValueSchema = z.union([
  z.array(fieldValueEntrySchema),
  fieldValueEntrySchema,
]);
type FieldValue = z.infer<typeof fieldValueSchema>;

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

const FullRelatedRecordField = (props: FullRelatedRecordFieldProps) => {
  // You may wish to cast this value
  const rawValue = props.state.value?.data || undefined;

  // Validate and parse the value
  const value = useMemo(
    () => fieldValueSchema.safeParse(rawValue).data,
    [rawValue]
  );

  // Normalize value to an array for consistent rendering
  const normalizedLinks = useMemo(() => {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }, [value]);

  const {mutate, isPending, isError, error} = useMutation({
    mutationFn: async () => {
      // Create new child
      const res = await props.config.dataEngine().form.createRecord({
        createdBy: props.config.user,
        formId: props.related_type,
        // Instantiate the new record with the relationship back to the parent
        relationship: {
          parent: {
            fieldId: props.fieldId,
            recordId: props.config.recordId,
            relationTypeVocabPair: relationTypeToPair(props.relation_type),
          },
        },
      });

      // Update current field value
      props.setFieldData([
        // Spread existing normalized links
        ...normalizedLinks,
        // Create new link
        {
          record_id: res.record._id,
          relation_type_vocabPair: relationTypeToPair(props.relation_type),
        },
      ] satisfies FieldValue);

      // Force a commit
      await props.config.trigger.commit();

      return res;
    },
    mutationKey: [
      'create-related-record',
      props.fieldId,
      props.config.recordId,
    ],
    onSuccess: res => {
      // Navigate to the new record on success
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
        return (
          (await props.config.dataEngine().hydrated.getHydratedRecord({
            recordId: record_id,
            config: {conflictBehaviour: 'pickLast'},
          })) ?? undefined
        );
      },
      networkMode: 'always',
    })),
  });

  const handleLinkClick = (recordId: string) => {
    // TODO: we will need to consider whether this should be an edit or view mode
    props.config.redirect.toRecord({recordId: recordId, mode: 'parent'});
  };

  return (
    <>
      {/* Error Alert */}
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
              <ListItem
                key={link.record_id}
                disablePadding
                divider={index < normalizedLinks.length - 1}
              >
                <ListItemButton
                  onClick={() => handleLinkClick(link.record_id)}
                  title="Click to view record"
                >
                  <ListItemIcon sx={{minWidth: 40}}>
                    <LinkIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={link.record_id} // TODO: Replace with HRID if available
                    secondary={link.relation_type_vocabPair[0]}
                    primaryTypographyProps={{
                      variant: 'body2',
                      fontFamily: 'monospace',
                    }}
                  />
                </ListItemButton>
              </ListItem>
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
      >
        <FullRelatedRecordField {...(props as FullRelatedRecordFieldProps)} />
      </FieldWrapper>
    );
  }
};

// generate a zod schema for the value.
const valueSchema = () => {
  return fieldValueSchema;
};

// Export a constant with the information required to
// register this field type
export const relatedRecordFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'RelatedRecordSelector',
  returns: 'faims-core::Relationship',
  component: RelatedRecordField,
  fieldSchema: relatedRecordPropsSchema,
  valueSchemaFunction: valueSchema,
};
