import {Alert, Button, CircularProgress} from '@mui/material';
import {useMutation} from '@tanstack/react-query';
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
// Types & Schema
// ============================================================================

const relatedRecordPropsSchema = BaseFieldPropsSchema.extend({
  // 'FormId' of the child/related record
  related_type: z.string(),
  // Relation type - either 'Child' or 'Linked'
  relation_type: z.enum(['faims-core::Child', 'faims-core::Linked']),
  // Allow selection of multiple related records
  multiple: z.boolean().optional().default(false),
  // The descriptive vocab pair (e.g. ['has child', 'is child of']) (again
  // unsure why we track here) - this is coming through as empty array [] for
  // some reason - ignore
  // relation_linked_vocabPair: z.tuple([z.string(), z.string()]),
  // Can you link to existing records, or only create new ones
  allowLinkToExisting: z.boolean().optional().default(false),
});

type RelatedRecordFieldProps = z.infer<typeof relatedRecordPropsSchema>;
type RelatedRecordProps = RelatedRecordFieldProps & FormFieldContextProps;

interface FullRelatedRecordFieldProps extends RelatedRecordProps {
  config: FullFormManagerConfig;
}

// NOTE this used to be singleton - but forcing into list now
const fieldValueEntrySchema = z.object({
  // ID of the linked record
  record_id: z.string(),
  // ID of the project (unsure why we have this) - NOTE making this optional
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

const FullRelatedRecordField = (props: FullRelatedRecordFieldProps) => {
  // You may wish to cast this value
  const rawValue = props.state.value?.data || undefined;

  // validate
  const value = useMemo(
    () => fieldValueSchema.safeParse(rawValue).data,
    [rawValue]
  );

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
        // If spread possible singular entry into array
        ...(value ? (Array.isArray(value) ? value : [value]) : []),
        // Create new link
        {
          record_id: res.record._id,
          relation_type_vocabPair: relationTypeToPair(props.relation_type),
        },
      ] satisfies FieldValue);

      // And force a commit - this is important as we may immediately navigate away
      console.log('Triggering commit after related record creation');
      await props.config.trigger.commit();
      console.log('Commit complete after related record creation');

      // Now we are ready to proceed
      return res;
    },
    // Make sure mutation is invalidated for changes in field ID / record ID /
    // form ID
    mutationKey: [
      'create-related-record',
      props.fieldId,
      props.config.recordId,
    ],
    onSuccess: res => {
      console.log('Navigating to new related record:', res.record._id);
      // Navigate to the new record on success
      props.config.redirect.toRecord({recordId: res.record._id, mode: 'new'});
    },
    networkMode: 'always',
    gcTime: 0,
  });

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

      {value ? (
        <>
          Existing links:
          {value instanceof Array ? (
            value.map(v => <div key={v.record_id}>- {v.record_id}</div>)
          ) : (
            <div></div>
          )}
        </>
      ) : (
        <p> No existing links </p>
      )}
    </>
  );
};

const RelatedRecordField = (props: BaseFieldProps & FormFieldContextProps) => {
  if (props.config.mode === 'preview') {
    return <>TODO preview</>;
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
  // TODO
  return z.any();
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
