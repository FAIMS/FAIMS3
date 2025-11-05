import {EncodedUISpecification} from '@faims3/data-model';
import {FaimsForm} from './types';
import {Field} from './Field';

interface FormSectionProps {
  uiSpec: EncodedUISpecification;
  section: string;
  form: FaimsForm;
}

// A form section contains the fields defined for one section of a form
export const FormSection = ({uiSpec, section, form}: FormSectionProps) => {
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
};
