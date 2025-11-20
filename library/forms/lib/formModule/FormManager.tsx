import type {
  AvpUpdateMode,
  DataEngine,
  FaimsAttachments,
  FormDataEntry,
  FormUpdateData,
  IAttachmentService,
  ProjectUIModel,
  StoreAttachmentResult,
} from '@faims3/data-model';
import {Button} from '@mui/material';
import {useForm, useStore} from '@tanstack/react-form';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useEffect, useState, type ComponentProps} from 'react';
import {FormSection} from './FormSection';
import {FaimsForm, FaimsFormData} from './types';

// Debounce time for form syncs
const FORM_SYNC_DEBOUNCE_MS = 1000;

const FormStateDisplay = ({form}: {form: FaimsForm}) => {
  const values = useStore(form.store, state => state.values);

  return (
    <div>
      <h3>Current Form Values:</h3>
      <pre>{JSON.stringify(values, null, 2)}</pre>
    </div>
  );
};

// Base interface for common properties
interface BaseFormConfig {
  mode: 'full' | 'preview';
}

// These are additional config injected by the form manager(s) and passed down
// to fields
export interface FormManagerAdditions {
  attachmentHandlers: {
    // Add new attachment (at start of attachment list)
    addAttachment: (params: {
      fieldId: string;
      blob: Blob;
      contentType: string;
    }) => Promise<void>;
    // Delete an attachment with given ID
    removeAttachment: (params: {
      fieldId: string;
      attachmentId: string;
    }) => Promise<void>;
  };
}

// Full mode - has access to data engine and full powers
export interface FullFormConfig extends BaseFormConfig {
  mode: 'full';
  // A function to generate an instance of the data engine - this is a function
  // as instance references may change due to DBs being updated
  dataEngine: () => DataEngine;
  // An attachment engine for use - again a function to generate
  attachmentEngine: () => IAttachmentService;
  // Functions which redirect to other records
  redirect: {
    // Go to a record (no revision specified)
    toRecord: (params: {recordId: string}) => void;
    // Go to a specific record revision
    toRevision: (params: {recordId: string; revisionId: string}) => void;
  };
  // Triggers for special behaviour
  trigger: {
    // This forces a commit of the record
    commit: () => void;
  };
  // Who is the active user - this helps when we need to create attachments
  // etc
  user: string;
}

// Preview mode - used for form previews which aren't in the context of a fully
// functional app - useful for designer (for example)
export interface PreviewFormConfig extends BaseFormConfig {
  mode: 'preview';
  // Currently there is no special config provided
}

// Discriminated union
export type FormConfig = FullFormConfig | PreviewFormConfig;

export type FullFormManagerConfig = FullFormConfig & FormManagerAdditions;
export type PreviewFormManagerConfig = PreviewFormConfig;
export type FormManagerConfig =
  | FullFormManagerConfig
  | PreviewFormManagerConfig;

export interface EditableFormManagerProps extends ComponentProps<any> {
  recordId: string;
  activeUser: string;
  mode: AvpUpdateMode;
  config: FullFormConfig;
  queryClient: QueryClient;
}

export const EditableFormManager = (props: EditableFormManagerProps) => {
  const [uiSpec, setUiSpec] = useState<ProjectUIModel | null>(null);
  const [record, setRecord] = useState<FormUpdateData | null>(null);
  const [dataEngine, setDataEngine] = useState<DataEngine | null>(null);
  const [formValues, setFormValues] = useState<FormUpdateData>({});
  const [formId, setFormId] = useState<string | null>(null);
  const [edited, setEdited] = useState<boolean>(false);
  const [workingRevisionId, setWorkingRevisionId] = useState<string | null>(
    null
  );

  /**
   * Helper function to ensure we have a working revision ready for edits.
   * On first edit of an existing record (parent mode), creates a new revision.
   * Returns the revision ID to use for the update.
   */
  const ensureWorkingRevision = async (): Promise<string | null> => {
    console.log(
      '%c[ensureWorkingRevision] Called',
      'background-color: purple; color: white',
      {
        edited,
        workingRevisionId,
        mode: props.mode,
        hasDataEngine: !!dataEngine,
      }
    );

    // If we don't have necessary data, we can't proceed
    if (!dataEngine || !workingRevisionId) {
      console.warn(
        '[ensureWorkingRevision] Missing dataEngine or workingRevisionId'
      );
      return workingRevisionId;
    }

    // If this is the first edit and we're in parent mode, create new revision
    if (!edited && props.mode === 'parent') {
      console.log(
        '%c[ensureWorkingRevision] Creating new revision',
        'background-color: purple; color: white',
        {
          recordId: props.recordId,
          parentRevisionId: workingRevisionId,
        }
      );

      try {
        const newRevision = await dataEngine.form.createRevision({
          recordId: props.recordId,
          revisionId: workingRevisionId,
          createdBy: props.activeUser,
        });

        console.log(
          '%c[ensureWorkingRevision] New revision created',
          'background-color: purple; color: white',
          newRevision
        );

        setWorkingRevisionId(newRevision._id);
        setEdited(true);
        return newRevision._id;
      } catch (error) {
        console.error(
          '[ensureWorkingRevision] Failed to create revision:',
          error
        );
        throw error;
      }
    }

    // Mark as edited if not already (for new records or other modes)
    if (!edited) {
      console.log(
        '[ensureWorkingRevision] Marking as edited (no new revision needed)'
      );
      setEdited(true);
    }

    return workingRevisionId;
  };

  const onChangeHandler = async () => {
    console.log(
      '%cForm values changed:',
      'background-color: green',
      form.state.values
    );

    // Ensure we have a working revision
    const revisionToUpdate = await ensureWorkingRevision();

    // Without these we can't do anything
    if (record && revisionToUpdate && dataEngine) {
      console.log('form state', form.state.values);
      // Update the working revision with the new data
      const updatedRecord: FormUpdateData = {
        ...record,
        ...form.state.values,
      };
      console.log(
        '%cUpdating revision:',
        'background-color: pink',
        revisionToUpdate,
        updatedRecord
      );
      dataEngine.form
        .updateRevision({
          revisionId: revisionToUpdate,
          recordId: props.recordId,
          updatedBy: props.activeUser,
          update: updatedRecord,
          mode: props.mode,
        })
        .then(updatedRecord => {
          console.log(
            '%cRecord updated:',
            'background-color: red',
            updatedRecord
          );
        });
    }
  };

  // TODO: probably want a hook to get the initial form
  // data, then we can populate the form with that data
  // https://tanstack.com/form/latest/docs/framework/react/guides/async-initial-values#basic-usage
  const form = useForm({
    defaultValues: formValues as FaimsFormData,
    onSubmit: ({value}) => {
      console.log('Form submitted with value:', value);
    },
    listeners: {
      onChangeDebounceMs: FORM_SYNC_DEBOUNCE_MS, // only run onChange every so often
      onChange: onChangeHandler,
    },
  });

  // Add additional handlers to produce a manager config
  // TODO consider useCallback memoisation
  const formManagerConfig: FullFormManagerConfig = {
    ...props.config,
    attachmentHandlers: {
      addAttachment: async ({fieldId, blob, contentType}) => {
        console.log(
          '%c[addAttachment] Starting',
          'background-color: blue; color: white',
          {
            fieldId,
            blobSize: blob.size,
            contentType,
            currentWorkingRevisionId: workingRevisionId,
          }
        );

        // Ensure we have a working revision before adding attachment
        const revisionToUse = await ensureWorkingRevision();

        if (!revisionToUse) {
          const error = 'No working revision available for attachment';
          console.error('[addAttachment]', error);
          throw new Error(error);
        }

        console.log('[addAttachment] Using revision:', revisionToUse);

        let attachmentResult: StoreAttachmentResult | undefined = undefined;

        // Current timestamp to disambiguate filenames
        const timestamp = new Date().toISOString();
        const filename = `photo_${timestamp}.${contentType}`;

        try {
          console.log('[addAttachment] Storing attachment to service:', {
            filename,
            revisionId: revisionToUse,
          });

          // Use the attachment service to store
          attachmentResult = await props.config
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

          console.log(
            '%c[addAttachment] Attachment stored successfully',
            'background-color: blue; color: white',
            attachmentResult
          );
        } catch (e: any) {
          console.error('[addAttachment] Failed to store attachment:', e);
          throw new Error(
            'Failed to store attachment: ' + (e as Error).message
          );
        }

        // Retrieve current state from the form
        const state = form.state.values[fieldId];
        console.log('[addAttachment] Current field state:', state);

        // We now have an attachment result - add to the beginning
        const newAttachments: FaimsAttachments = [
          {
            attachmentId: attachmentResult.identifier.id,
            filename: attachmentResult.metadata.filename,
            fileType: attachmentResult.metadata.contentType,
          },
          ...(state?.attachments ?? []),
        ];

        console.log('[addAttachment] New attachments array:', newAttachments);

        // Then create new overall field
        const newValue: FormDataEntry = {
          ...(state || {}),
          attachments: newAttachments,
        };

        console.log('[addAttachment] Setting new field value:', newValue);

        // Update value
        form.setFieldValue(fieldId, newValue);

        // Calling on change handler
        console.log(
          '%c[addAttachment] calling onChangeHandler',
          'background-color: green; color: white'
        );
        await onChangeHandler();

        console.log(
          '%c[addAttachment] Complete',
          'background-color: blue; color: white'
        );
      },
      removeAttachment: async ({fieldId, attachmentId}) => {
        console.log(
          '%c[removeAttachment] Starting',
          'background-color: orange; color: white',
          {
            fieldId,
            attachmentId,
            currentWorkingRevisionId: workingRevisionId,
          }
        );

        // Ensure we have a working revision before removing attachment
        const revisionToUse = await ensureWorkingRevision();

        if (!revisionToUse) {
          const error = 'No working revision available for attachment removal';
          console.error('[removeAttachment]', error);
          throw new Error(error);
        }

        console.log('[removeAttachment] Using revision:', revisionToUse);

        // Retrieve current state from the form
        const state = form.state.values[fieldId];
        console.log('[removeAttachment] Current field state:', state);

        if (!state?.attachments) {
          console.warn('[removeAttachment] No attachments found in field');
          return;
        }

        // Filter out the attachment to remove
        const newAttachments: FaimsAttachments = state.attachments.filter(
          attachment => attachment.attachmentId !== attachmentId
        );

        console.log('[removeAttachment] New attachments array:', {
          originalCount: state.attachments.length,
          newCount: newAttachments.length,
          removedAttachment: attachmentId,
        });

        // Create new field value with updated attachments
        const newValue: FormDataEntry = {
          ...(state || {}),
          attachments: newAttachments,
        };

        console.log('[removeAttachment] Setting new field value:', newValue);

        // Update value
        form.setFieldValue(fieldId, newValue);

        // Calling on change handler
        console.log(
          '%c[addAttachment] calling onChangeHandler',
          'background-color: green; color: white'
        );
        await onChangeHandler();

        console.log(
          '%c[removeAttachment] Complete',
          'background-color: orange; color: white'
        );
      },
    },
  };

  // Get the record data and populate the form values when it is available
  useEffect(() => {
    const fn = async () => {
      const engine = props.config.dataEngine();
      setDataEngine(engine);
      setUiSpec(engine.uiSpec);

      const {revisionId, formId, data} = await engine.form.getExistingFormData({
        recordId: props.recordId,
        revisionId: props.revisionId,
      });
      setFormId(formId);
      setWorkingRevisionId(revisionId);
      setRecord(data);
      console.log('Loaded form data:', revisionId, formId, data);
      setFormValues(data);
    };
    fn();
  }, [props.recordId, props.config]);

  console.log('Loaded record:', record);

  if (!record || !uiSpec || !form || !formId) {
    return <div>Record {props.recordId} not found</div>;
  } else {
    return (
      <>
        <Button
          variant="contained"
          onClick={() => props.config.trigger.commit()}
        >
          Finish
        </Button>
        <Button
          variant="contained"
          onClick={() => props.config.trigger.commit()}
        >
          Finish and New
        </Button>
        <Button
          variant="contained"
          onClick={() => props.config.trigger.commit()}
        >
          Cancel
        </Button>

        <FormManager
          form={form}
          formName={formId}
          uiSpec={uiSpec}
          queryClient={props.queryClient}
          config={formManagerConfig}
        />
      </>
    );
  }
};

export interface PreviewFormManagerProps extends ComponentProps<any> {
  formName: string;
  uiSpec: ProjectUIModel;
  queryClient: QueryClient;
}

export const PreviewFormManager = (props: PreviewFormManagerProps) => {
  console.log('PreviewFormManager:', props);

  const formValues = {
    'Full-Name': 'Steve',
    Occupation: 'Developer',
    Description: '',
    Selection: '',
  };
  const form = useForm({
    defaultValues: formValues as FaimsFormData,
    onSubmit: ({value}) => {
      console.log('Form submitted with value:', value);
    },
    listeners: {
      onChange: () => {
        console.log('Form values changed:', form.state.values);
      },
    },
  });

  const config: PreviewFormConfig = {
    mode: 'preview' as const,
  };

  return (
    <FormManager
      form={form}
      formName={props.formName}
      uiSpec={props.uiSpec}
      config={config}
      queryClient={props.queryClient}
    />
  );
};

export interface FormManagerProps extends ComponentProps<any> {
  formName: string;
  form: FaimsForm;
  uiSpec: ProjectUIModel;
  config: FormManagerConfig;
  queryClient: QueryClient;
}

export const FormManager = (props: FormManagerProps) => {
  console.log('FormManager:', props);

  const formSpec = props.uiSpec.viewsets[props.formName];
  console.log('Form Spec:', formSpec);

  return (
    <QueryClientProvider client={props.queryClient}>
      <h2>Form: {formSpec.label}</h2>

      <form
        onSubmit={e => {
          e.preventDefault();
          e.stopPropagation();
          props.form.handleSubmit();
        }}
      >
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
      <FormStateDisplay form={props.form} />
    </QueryClientProvider>
  );
};
