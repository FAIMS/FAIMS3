import type {
  DataEngine,
  ExistingFormRecord,
  HydratedRecord,
  IAttachmentService,
  ProjectUIModel
} from '@faims3/data-model';
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
  revisionId?: string;
  config: FullFormConfig;
}

export const EditableFormManager = (props: EditableFormManagerProps) => {
  console.log('FormManager:', props);

  const [uiSpec, setUiSpec] = useState<ProjectUIModel | null>(null);
  const [record, setRecord] = useState<ExistingFormRecord | null>(null);
  const [dataEngine, setDataEngine] = useState<DataEngine | null>(null);
  const [formValues, setFormValues] = useState<FaimsFormData>({});

  // TODO: probably want a hook to get the initial form
  // data, then we can populate the form with that data
  // https://tanstack.com/form/latest/docs/framework/react/guides/async-initial-values#basic-usage

  const form = useForm({
    defaultValues: formValues as FaimsFormData,
    onSubmit: ({value}) => {
      console.log('Form submitted with value:', value);
    },
    listeners: {
      onChangeDebounceMs: 1000, // only run onChange every 500ms
      onChange: () => {
        console.log('Form values changed:', form.state.values);
        // here we can update the current version of the record with the new values
        if (record && dataEngine) {
          const updatedRecord: ExistingFormRecord = {
            ...record,
            data: form.state.values,
          };
          dataEngine.form.updateRecord(updatedRecord, {
            updatedBy: record.createdBy, // TODO need current user
          }).then(updatedRecord => {
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

      const record = await engine.form.getExistingFormRecord({
        recordId: props.recordId,
        revisionId: props.revisionId,
      });
      setRecord(record);

      // get the initial values from the form
      const values: FaimsFormData = {};
      for (const fieldName in record.data) {
        values[fieldName] = record.data[fieldName];
      }
      setFormValues(values);
    };
    fn();
  }, [props.recordId, props.config]);

  console.log('Loaded record:', record);

  if (!record || !uiSpec || !form) {
    return <div>Record {props.recordId} not found</div>;
  } else {
    return (
      <FormManager
        form={form}
        formName={record.formId}
        uiSpec={uiSpec}
        config={props.config}
      />
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
    <FormManager
      form={form}
      formName={props.formName}
      uiSpec={props.uiSpec}
      config={config}
    />
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
    <>
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
    </>
  );
};
