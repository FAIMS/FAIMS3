import type {
  DataEngine,
  EncodedNotebook,
  IAttachmentService,
} from '@faims3/data-model';
import {useForm, useStore} from '@tanstack/react-form';
import type {ComponentProps} from 'react';
import {FaimsForm, FaimsFormData} from './types';
import {FormSection} from './FormSection';

const formValues = {
  'Full-Name': 'Steve',
  Occupation: 'Developer',
  Description: '',
  Selection: '',
};

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

export interface FormManagerProps extends ComponentProps<any> {
  project: EncodedNotebook;
  formName: string;
  config: FormConfig;
}

export const FormManager = (props: FormManagerProps) => {
  console.log('FormManager:', props.formName);

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

  const uiSpec = props.project['ui-specification'];
  const formSpec = uiSpec.viewsets[props.formName];

  return (
    <>
      <h2>Form: {formSpec.label}</h2>

      <form
        onSubmit={e => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
      >
        {formSpec.views.map((sectionName: string) => (
          <FormSection
            key={sectionName}
            form={form}
            uiSpec={uiSpec}
            section={sectionName}
            config={props.config}
          />
        ))}
      </form>
      <FormStateDisplay form={form} />
    </>
  );
};
