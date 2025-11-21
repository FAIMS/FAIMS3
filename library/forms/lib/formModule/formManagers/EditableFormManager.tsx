import {
  AvpUpdateMode,
  FaimsAttachments,
  FormDataEntry,
  FormUpdateData,
} from '@faims3/data-model';
import {Button} from '@mui/material';
import {useForm} from '@tanstack/react-form';
import {useQuery} from '@tanstack/react-query';
import {ComponentProps, useCallback, useEffect, useMemo, useState} from 'react';
import {FaimsFormData} from '../types';
import {FormManager} from './FormManager';
import {FullFormConfig, FullFormManagerConfig} from './types';

/**
 * Debounce time for form syncs to prevent excessive updates to the backend.
 * Changes are batched and saved after this delay (in milliseconds).
 */
const FORM_SYNC_DEBOUNCE_MS = 1000;

/**
 * Props for the EditableFormManager component.
 */
export interface EditableFormManagerProps extends ComponentProps<any> {
  /** The record ID being edited */
  recordId: string;
  /** The currently active user */
  activeUser: string;
  /** Update mode - determines revision creation behavior */
  mode: AvpUpdateMode;
  /** Full configuration with data engine access */
  config: FullFormConfig;
}

/**
 * EditableFormManager - Manages a full-featured editable form with backend
 * synchronization.
 *
 * This component handles:
 * - Loading form data from the data engine
 * - Creating new revisions when editing existing records (in 'parent' mode)
 * - Debounced auto-saving of form changes
 * - Attachment management (add/remove)
 * - Form submission and completion
 */
export const EditableFormManager = (props: EditableFormManagerProps) => {
  // Track whether any edits have been made (triggers revision creation in
  // parent mode)
  const [edited, setEdited] = useState(false);

  // The revision ID we're currently working with (may change after first edit
  // in parent mode)
  const [workingRevisionId, setWorkingRevisionId] = useState<string | null>(
    null
  );

  // Get the data engine instance
  const dataEngine = useMemo(() => {
    return props.config.dataEngine();
  }, [props.config.dataEngine]);

  // Fetch initial form data using TanStack Query for caching and loading states
  const {data: formData, isLoading} = useQuery({
    queryKey: ['formData', props.recordId],
    queryFn: async () => {
      // Get the hydrated record data in the form format
      return await dataEngine.form.getExistingFormData({
        recordId: props.recordId,
        revisionId: props.revisionId,
      });
    },
    // Try offline
    networkMode: 'always',
    // Always refetch on mount to get fresh data
    refetchOnMount: 'always',
  });

  // Update our working revision ID when form data loads
  useEffect(() => {
    if (formData?.revisionId) {
      setWorkingRevisionId(formData.revisionId);
    }
  }, [formData?.revisionId]);

  /**
   * Ensures we have a working revision ready for edits.
   *
   * In 'parent' mode, the first edit creates a new child revision to preserve
   * history. This implements the AVP (Attribute-Value-Pair) versioning strategy
   * where:
   * - The original revision remains unchanged (parent)
   * - A new revision is created as a child for edits
   * - Subsequent edits continue on the same child revision
   *
   * @returns The revision ID to use for updates, or null if unavailable
   */
  const ensureWorkingRevision = useCallback(async (): Promise<
    string | null
  > => {
    if (!workingRevisionId) {
      console.warn('No working revision available');
      return null;
    }
    let relevantRevisionId = workingRevisionId;

    // Create new revision on first edit in parent mode
    if (!edited && props.mode === 'parent') {
      try {
        const newRevision = await dataEngine.form.createRevision({
          recordId: props.recordId,
          revisionId: workingRevisionId,
          createdBy: props.activeUser,
        });

        setWorkingRevisionId(newRevision._id);
        relevantRevisionId = newRevision._id;
      } catch (error) {
        console.error('Failed to create revision:', error);
        throw error;
      }
    }

    // Mark as edited for non-parent modes or subsequent edits
    if (!edited) {
      setEdited(true);
    }

    // Either the current or newly created revision ID
    return relevantRevisionId;
  }, [
    edited,
    workingRevisionId,
    props.mode,
    props.recordId,
    props.activeUser,
    dataEngine,
  ]);

  /**
   * Handler called when form values change (debounced).
   * Merges current form state with existing data and saves to the backend.
   */
  const onChange = useCallback(async () => {
    const revisionToUpdate = await ensureWorkingRevision();

    if (formData?.data && revisionToUpdate) {
      // Merge existing data with current form values
      const updatedRecord: FormUpdateData = {
        ...formData.data,
        ...form.state.values,
      };

      try {
        await dataEngine.form.updateRevision({
          revisionId: revisionToUpdate,
          recordId: props.recordId,
          updatedBy: props.activeUser,
          update: updatedRecord,
          mode: props.mode,
        });
      } catch (error) {
        console.error('Failed to update revision:', error);
      }
    }
  }, [
    formData?.data,
    ensureWorkingRevision,
    props.recordId,
    props.activeUser,
    props.mode,
    dataEngine,
  ]);

  // Initialize TanStack Form with loaded data and change handlers
  const form = useForm({
    defaultValues: (formData?.data ?? {}) as FaimsFormData,
    onSubmit: ({value}) => {
      console.log('Form submitted:', value);
    },
    listeners: {
      // Debounce changes to avoid excessive backend calls
      onChangeDebounceMs: FORM_SYNC_DEBOUNCE_MS,
      onChange,
    },
  });

  /**
   * Handles adding a new attachment (photo/file) to a field.
   *
   * Process:
   * 1. Ensure we have a working revision (creates one if needed)
   * 2. Store the blob in the attachment service with metadata
   * 3. Add attachment reference to the beginning of the field's attachment list
   * 4. Update form state and trigger save
   *
   * @param fieldId - The field to add the attachment to
   * @param blob - The file data as a Blob
   * @param contentType - MIME type of the file (e.g., 'image/jpeg')
   */
  const handleAddAttachment = useCallback(
    async ({
      fieldId,
      blob,
      contentType,
      type,
      fileFormat,
    }: {
      fieldId: string;
      blob: Blob;
      contentType: string;
      type: 'photo' | 'file';
      fileFormat: string;
    }) => {
      // Ensure we have a revision to attach to
      const revisionToUse = await ensureWorkingRevision();

      if (!revisionToUse) {
        throw new Error('No working revision available for attachment');
      }

      // Generate unique filename with timestamp
      const timestamp = new Date().toISOString();
      const filename = `${type === 'photo' ? 'photo' : 'file'}_${timestamp}.${fileFormat}`;

      // Store attachment in the attachment service
      const attachmentResult = await props.config
        .attachmentEngine()
        .storeAttachmentFromBlob({
          blob,
          metadata: {
            attachmentDetails: {
              filename,
              contentType,
            },
            recordContext: {
              recordId: props.recordId,
              revisionId: revisionToUse,
              created: timestamp,
              createdBy: props.activeUser,
            },
          },
        });

      // Get current field state
      const state = form.state.values[fieldId];

      // Add new attachment to the beginning of the list
      const newAttachments: FaimsAttachments = [
        {
          attachmentId: attachmentResult.identifier.id,
          filename: attachmentResult.metadata.filename,
          fileType: attachmentResult.metadata.contentType,
        },
        ...(state?.attachments ?? []),
      ];

      // Create updated field value
      const newValue: FormDataEntry = {
        ...(state || {}),
        attachments: newAttachments,
      };

      // Update form and trigger save
      form.setFieldValue(fieldId, newValue);
    },
    [
      ensureWorkingRevision,
      props.config,
      props.recordId,
      props.activeUser,
      form,
    ]
  );

  /**
   * Handles removing an attachment from a field.
   *
   * Process:
   * 1. Ensure we have a working revision
   * 2. Filter out the attachment with the given ID
   * 3. Update form state and trigger save
   *
   * Note: This only removes the reference from the field - the actual attachment
   * file remains in storage for historical/audit purposes.
   *
   * @param fieldId - The field to remove the attachment from
   * @param attachmentId - The ID of the attachment to remove
   */
  const handleRemoveAttachment = useCallback(
    async ({
      fieldId,
      attachmentId,
    }: {
      fieldId: string;
      attachmentId: string;
    }) => {
      // Ensure we have a revision to modify
      const revisionToUse = await ensureWorkingRevision();

      if (!revisionToUse) {
        throw new Error('No working revision available for attachment removal');
      }

      // Get current field state
      const state = form.state.values[fieldId];

      if (!state?.attachments) {
        console.warn('No attachments found in field');
        return;
      }

      // Filter out the attachment to remove
      const newAttachments: FaimsAttachments = state.attachments.filter(
        attachment => attachment.attachmentId !== attachmentId
      );

      // Create updated field value
      const newValue: FormDataEntry = {
        ...(state || {}),
        attachments: newAttachments,
      };

      // Update form and trigger save
      form.setFieldValue(fieldId, newValue);
    },
    [ensureWorkingRevision, form]
  );

  // Combine base config with attachment handlers for field components
  const formManagerConfig: FullFormManagerConfig = {
    ...props.config,
    attachmentHandlers: {
      addAttachment: handleAddAttachment,
      removeAttachment: handleRemoveAttachment,
    },
  };

  // Loading state
  if (isLoading || !formData) {
    return <div>Loading...</div>;
  }

  // Error state - record not found
  if (!formData.data || !formData.formId) {
    return <div>Record {props.recordId} not found</div>;
  }

  return (
    <>
      {/* Action buttons for form completion */}
      <Button variant="contained" onClick={() => props.config.trigger.commit()}>
        Finish
      </Button>
      <Button variant="contained" onClick={() => props.config.trigger.commit()}>
        Finish and New
      </Button>
      <Button variant="contained" onClick={() => props.config.trigger.commit()}>
        Cancel
      </Button>

      {/* Main form component */}
      <FormManager
        form={form}
        formName={formData.formId}
        uiSpec={dataEngine.uiSpec}
        config={formManagerConfig}
      />
    </>
  );
};
