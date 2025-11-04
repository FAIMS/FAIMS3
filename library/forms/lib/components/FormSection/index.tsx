import {EncodedUISpecification} from '@faims3/data-model';
import {Field} from '../Field';
import React from 'react';

// This doesn't help...
// type FormAnyType = FormApi<
//   any,
//   FormValidateOrFn<any>,
//   FormValidateOrFn<any>,
//   FormAsyncValidateOrFn<any>,
//   FormValidateOrFn<any>,
//   FormAsyncValidateOrFn<any>,
//   FormValidateOrFn<any>,
//   FormAsyncValidateOrFn<any>,
//   FormValidateOrFn<any>,
//   FormAsyncValidateOrFn<any>,
//   FormAsyncValidateOrFn<any>,
//   any
// >;

interface FormSectionProps {
  uiSpec: EncodedUISpecification;
  section: string;
  form: any; // would like to type this but the type is too hairy
}

// A form section contains the fields defined for one section of a form
export const FormSection = React.memo(
  ({uiSpec, section, form}: FormSectionProps) => {
    const sectionSpec = uiSpec.fviews[section];
    if (!sectionSpec) {
      throw new Error(`Section ${section} not found in UISpec`);
    }

    console.log('Section:', sectionSpec.label);

    return (
      <div>
        <h2>Section: {sectionSpec.label}</h2>
        {sectionSpec.fields.map((fieldName: string) => {
          const fieldSpec = uiSpec.fields[fieldName];
          return <Field form={form} fieldSpec={fieldSpec} key={fieldName} />;
        })}
      </div>
    );
  }
);
