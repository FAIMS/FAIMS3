import React from 'react';
import type {ComponentProps} from 'react';
import type {EncodedNotebook} from '@faims3/data-model';
import {FormSection} from '../FormSection';
import {useForm, useStore} from '@tanstack/react-form';

const formValues = {
  'Full-Name': 'Steve',
  Occupation: 'Developer',
  Description: '',
  Selection: '',
};

const FormStateDisplay = ({form}: {form: any}) => {
  const values = useStore(form.store, (state: any) => state.values);

  return (
    <div>
      <h3>Current Form Values:</h3>
      <pre>{JSON.stringify(values, null, 2)}</pre>
    </div>
  );
};

export interface FormManagerProps extends ComponentProps<any> {
  project: EncodedNotebook;
  formName: string;
}

export const FormManager = (props: FormManagerProps) => {
  console.log('FormManager:', props.formName);

  const form = useForm({
    defaultValues: formValues,
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
          />
        ))}
      </form>
      <FormStateDisplay form={form} />
    </>
  );
};
