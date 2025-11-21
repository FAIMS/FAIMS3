import type {
  AvpUpdateMode,
  DataEngine,
  FaimsAttachments,
  FormDataEntry,
  FormUpdateData,
  IAttachmentService,
  ProjectUIModel,
} from '@faims3/data-model';
import {Button} from '@mui/material';
import {useForm, useStore} from '@tanstack/react-form';
import {useQuery} from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from 'react';
import {FormSection} from './FormSection';
import {FaimsForm, FaimsFormData} from './types';

/**
 * Debounce time for form syncs to prevent excessive updates to the backend.
 * Changes are batched and saved after this delay (in milliseconds).
 */
const FORM_SYNC_DEBOUNCE_MS = 1000;

/**
 * Debug component that displays the current form values in JSON format.
 * Useful for development and testing to see form state in real-time.
 */
const FormStateDisplay = ({form}: {form: FaimsForm}) => {
  const values = useStore(form.store, state => state.values);

  return (
    <div>
      <h3>Current Form Values:</h3>
      <pre>{JSON.stringify(values, null, 2)}</pre>
    </div>
  );
};

/**
 * Base interface for form configuration modes.
 */
interface BaseFormConfig {
  mode: 'full' | 'preview';
}

/**
 * Additional handlers injected by the form manager and passed down to field components.
 * These allow fields to interact with attachments (photos, files, etc.).
 */
export interface FormManagerAdditions {
  attachmentHandlers: {
    /** Add a new attachment to a field (inserted at start of attachment list) */
    addAttachment: (params: {
      fieldId: string;
      blob: Blob;
      contentType: string;
    }) => Promise<void>;
    /** Remove an attachment from a field by its ID */
    removeAttachment: (params: {
      fieldId: string;
      attachmentId: string;
    }) => Promise<void>;
  };
}

/**
 * Full mode configuration - provides complete data engine access and functionality.
 * Used when forms are embedded in the full application context.
 */
export interface FullFormConfig extends BaseFormConfig {
  mode: 'full';
  /** Function to get current data engine instance (function allows for DB updates) */
  dataEngine: () => DataEngine;
  /** Function to get attachment service instance */
  attachmentEngine: () => IAttachmentService;
  /** Navigation functions for redirecting to other records */
  redirect: {
    /** Navigate to a record (latest revision) */
    toRecord: (params: {recordId: string}) => void;
    /** Navigate to a specific record revision */
    toRevision: (params: {recordId: string; revisionId: string}) => void;
  };
  /** Special behavior triggers */
  trigger: {
    /** Force a commit/save of the current record */
    commit: () => void;
  };
  /** Current active user identifier (for audit trails) */
  user: string;
}

/**
 * Preview mode configuration - limited functionality for form
 * designer/previews. Used when forms are displayed outside the full application
 * context.
 */
export interface PreviewFormConfig extends BaseFormConfig {
  mode: 'preview';
}

// Discriminated union
export type FormConfig = FullFormConfig | PreviewFormConfig;

export type FullFormManagerConfig = FullFormConfig & FormManagerAdditions;
export type PreviewFormManagerConfig = PreviewFormConfig;
export type FormManagerConfig =
  | FullFormManagerConfig
  | PreviewFormManagerConfig;

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
    }: {
      fieldId: string;
      blob: Blob;
      contentType: string;
    }) => {
      // Ensure we have a revision to attach to
      const revisionToUse = await ensureWorkingRevision();

      if (!revisionToUse) {
        throw new Error('No working revision available for attachment');
      }

      // Generate unique filename with timestamp
      const timestamp = new Date().toISOString();
      const filename = `photo_${timestamp}.${contentType}`;

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
      await onChange();
    },
    [
      ensureWorkingRevision,
      props.config,
      props.recordId,
      props.activeUser,
      form,
      onChange,
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
      await onChange();
    },
    [ensureWorkingRevision, form, onChange]
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

/**
 * Props for the PreviewFormManager component.
 */
export interface PreviewFormManagerProps extends ComponentProps<any> {
  /** The name/ID of the form to preview */
  formName: string;
  /** The UI specification containing form structure */
  uiSpec: ProjectUIModel;
}

/**
 * PreviewFormManager - A simplified form manager for previewing forms.
 *
 * Used in contexts like the form designer where we want to show how a form
 * will look and behave, but without backend integration or data persistence.
 * Uses mock/test data for demonstration purposes.
 */
export const PreviewFormManager = (props: PreviewFormManagerProps) => {
  // Mock form values for preview
  const formValues = {
    'Full-Name': 'Steve',
    Occupation: 'Developer',
    Description: '',
    Selection: '',
  };

  // Initialize form with mock data and simple logging
  const form = useForm({
    defaultValues: formValues as FaimsFormData,
    onSubmit: ({value}) => {
      console.log('Form submitted:', value);
    },
    listeners: {
      onChange: () => {
        console.log('Form values changed:', form.state.values);
      },
    },
  });

  // Preview mode config (no backend integration)
  const config: PreviewFormConfig = {
    mode: 'preview' as const,
  };

  return (
    <FormManager
      form={form}
      formName={props.formName}
      uiSpec={props.uiSpec}
      config={config}
    />
  );
};

/**
 * Props for the base FormManager component.
 */
export interface FormManagerProps extends ComponentProps<any> {
  /** The name/ID of the form to render */
  formName: string;
  /** TanStack Form instance managing form state */
  form: FaimsForm;
  /** UI specification containing form structure and field definitions */
  uiSpec: ProjectUIModel;
  /** Configuration determining form mode and available features */
  config: FormManagerConfig;
}

/**
 * FormManager - Base form rendering component.
 *
 * This component handles the actual rendering of form sections and fields
 * based on the UI specification. It's used by both EditableFormManager
 * (full mode) and PreviewFormManager (preview mode).
 *
 * The form structure is defined in the uiSpec, which maps form names to
 * viewsets containing sections (views), which in turn contain fields.
 */
export const FormManager = (props: FormManagerProps) => {
  // Get the form specification from the UI spec
  const formSpec = props.uiSpec.viewsets[props.formName];

  return (
    <>
      <h2>Form: {formSpec.label}</h2>

      <form
        onSubmit={e => {
          e.preventDefault();
          e.stopPropagation();
          props.form.handleSubmit();
        }}
      >
        {/* Render each section defined in the form spec */}
        {formSpec.views.map((sectionName: string) => (
          <FormSection
            key={sectionName}
            form={props.form}
            uiSpec={props.uiSpec}
            section={sectionName}
            config={props.config}
          />
        ))}
      </form>

      {/* Debug display of current form state */}
      <FormStateDisplay form={props.form} />
    </>
  );
};
