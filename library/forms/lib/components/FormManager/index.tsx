import React from 'react';
import type {ComponentProps} from 'react';
import type {EncodedNotebook} from '@faims3/data-model';
import {FormSection} from '../FormSection';
import {FormContext, FormContextType} from './FormContext';

const formValues = {
  'Full-Name': 'Steve',
  Occupation: 'Developer',
};

export interface FormManagerProps extends ComponentProps<any> {
  project: EncodedNotebook;
  formName: string;
}

export const FormManager = (props: FormManagerProps) => {
  console.log('FormManager:', props.formName);
  const [currentValues, setCurrentValues] =
    React.useState<Record<string, any>>(formValues);

  // stable reference to setValue function used by fields to update
  // the value of a field in the form state
  const setValue = React.useCallback((fieldName: string, value: any) => {
    console.log(`Set field ${fieldName} to value ${value}`);
    setCurrentValues(prev => ({
      ...prev,
      [fieldName]: value,
    }));
  }, []);

  // Stable reference to current values
  const valuesRef = React.useRef(currentValues);
  valuesRef.current = currentValues;

  const getValue = React.useCallback((fieldName: string) => {
    return valuesRef.current[fieldName];
  }, []);

  // Memoize context value - only recreate if callbacks change
  const contextValue: FormContextType = React.useMemo(
    () => ({
      setValue,
      getValue,
    }),
    [setValue, getValue]
  );

  const uiSpec = props.project['ui-specification'];
  const formSpec = uiSpec.viewsets[props.formName];

  return (
    <FormContext.Provider value={contextValue}>
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
            />
          ))}
        </form>
        <div>
          <h3>Current Form Values:</h3>
          <pre>{JSON.stringify(currentValues, null, 2)}</pre>
        </div>
      </div>
    </FormContext.Provider>
  );
};
