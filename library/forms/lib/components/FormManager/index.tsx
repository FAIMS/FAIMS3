import React from 'react';
import type {ComponentProps} from 'react';
import type {EncodedNotebook} from '@faims3/data-model';
import {FormSection} from '../FormSection';

const formValues = {};

export interface FormManagerProps extends ComponentProps<any> {
  project: EncodedNotebook;
  formName: string;
}

export const FormManager = (props: FormManagerProps) => {
  const [currentValues, setCurrentValues] =
    React.useState<Record<string, any>>(formValues);

  const setValue = (fieldName: string, value: any) => {
    console.log(`Set field ${fieldName} to value ${value}`);
    setCurrentValues({
      ...currentValues,
      [fieldName]: value,
    });
  };

  console.log('FormManager props:', props);

  const uiSpec = props.project['ui-specification'];
  const formSpec = uiSpec.viewsets[props.formName];

  return (
    <div
      style={{padding: '16px', border: '1px solid #ccc', borderRadius: '8px'}}
    >
      <h2>Form: {formSpec.label}</h2>

      <form>
        {formSpec.views.map((sectionName: string) => (
          <FormSection
            key={sectionName}
            uiSpec={uiSpec}
            section={sectionName}
            setValue={setValue}
            values={currentValues}
          />
        ))}
      </form>
      <div>
        <h3>Current Form Values:</h3>
        <pre>{JSON.stringify(currentValues, null, 2)}</pre>
      </div>
    </div>
  );
};
