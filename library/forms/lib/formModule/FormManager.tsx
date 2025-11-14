import type {
  AvpUpdateMode,
  DataEngine,
  FormUpdateData,
  IAttachmentService,
  ProjectUIModel,
} from '@faims3/data-model';
import {Box, Button} from '@mui/material';
import {useForm, useStore} from '@tanstack/react-form';
import {useEffect, useState, type ComponentProps} from 'react';
import {FormSection} from './FormSection';
import {FaimsForm, FaimsFormData} from './types';

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
interface BaseFormContext {
  mode: 'full' | 'preview';
}

// Full mode - has access to data engine and full powers
export interface FullFormContext extends BaseFormContext {
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
}

// Preview mode - used for form previews which aren't in the context of a fully
// functional app - useful for designer (for example)
export interface PreviewFormContext extends BaseFormContext {
  mode: 'preview';

  // Currently there is no special context provided
}

// Discriminated union
export type FormContext = FullFormContext | PreviewFormContext;

export interface FormConfig {
  context: FormContext;
}

export interface FullFormConfig {
  context: FullFormContext;
}

export interface EditableFormManagerProps extends ComponentProps<any> {
  recordId: string;
  activeUser: string;
  mode: AvpUpdateMode;
  config: FullFormConfig;
}

export const EditableFormManager = (props: EditableFormManagerProps) => {
  console.log('FormManager:', props);

  const [uiSpec, setUiSpec] = useState<ProjectUIModel | null>(null);
  const [record, setRecord] = useState<FormUpdateData | null>(null);
  const [dataEngine, setDataEngine] = useState<DataEngine | null>(null);
  const [formValues, setFormValues] = useState<FormUpdateData>({});
  const [formId, setFormId] = useState<string | null>(null);
  const [edited, setEdited] = useState<boolean>(false);

  const [workingRevisionId, setWorkingRevisionId] = useState<string | null>(
    null
  );

  // TODO: probably want a hook to get the initial form
  // data, then we can populate the form with that data
  // https://tanstack.com/form/latest/docs/framework/react/guides/async-initial-values#basic-usage

  const form = useForm({
    defaultValues: formValues as FaimsFormData,
    onSubmit: ({value}) => {
      console.log('Form submitted with value:', value);
    },
    listeners: {
      onChangeDebounceMs: 1000, // only run onChange so often
      onChange: async () => {
        console.log(
          '%cForm values changed:',
          'background-color: green',
          form.state.values
        );
        console.log('FirstEdit:', edited);

        // this might change if we make a new revision below
        let revisionToUpdate = workingRevisionId;

        // without these we can't do anything
        // need to know the revision we need to update and have a data engine
        // and if we don't have the current record then we're a bit lost
        if (record && revisionToUpdate && dataEngine) {
          // if this is the first change, and this is not a new record,
          // we create a new revision and this becomes our working revision
          // Q: do we need to remember the parent revision?
          if (!edited) {
            console.log('First edit');
            setEdited(true);

            if (props.mode === 'parent') {
              const newRevision = await dataEngine?.form.createRevision({
                recordId: props.recordId,
                revisionId: revisionToUpdate,
                createdBy: props.activeUser,
              });
              setWorkingRevisionId(newRevision._id);
              revisionToUpdate = newRevision._id;
              console.log('New working revision:', newRevision);
            }
          }

          console.log('form state', form.state.values);
          // then we update the working revision with the new data
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
      },
    },
  });

  // Get the record data and populate the form values when it is available
  useEffect(() => {
    const fn = async () => {
      const engine = props.config.context.dataEngine();
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
          onClick={() => props.config.context.trigger.commit()}
        >
          Finish
        </Button>
        <Button
          variant="contained"
          onClick={() => props.config.context.trigger.commit()}
        >
          Finish and New
        </Button>
        <Button
          variant="contained"
          onClick={() => props.config.context.trigger.commit()}
        >
          Cancel
        </Button>

        <FormManager
          form={form}
          formName={formId}
          uiSpec={uiSpec}
          config={props.config}
        />
        <FormStateDisplay form={form} />
      </>
    );
  }
};

export interface PreviewFormManagerProps extends ComponentProps<any> {
  formName: string;
  uiSpec: ProjectUIModel;
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

  const config = {
    context: {
      mode: 'preview' as const,
    },
  };

  return (
    <Box
      sx={{
        border: '1px solid gray',
        padding: 2,
        borderRadius: 2,
        width: '100%',
      }}
    >
      <h2>Preview</h2>
      <FormManager
        form={form}
        formName={props.formName}
        uiSpec={props.uiSpec}
        config={config}
      />
    </Box>
  );
};

export interface FormManagerProps extends ComponentProps<any> {
  formName: string;
  form: FaimsForm;
  uiSpec: ProjectUIModel;
  config: {
    context: FormContext;
  };
}

export const FormManager = (props: FormManagerProps) => {
  console.log('FormManager:', props);

  const formSpec = props.uiSpec.viewsets[props.formName];
  console.log('Form Spec:', formSpec);

  return (
    <Box>
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
    </Box>
  );
};
