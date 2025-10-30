import {EncodedUISpecification} from '@faims3/data-model';
import {Field} from '../Field';

interface FormSectionProps {
  uiSpec: EncodedUISpecification;
  section: string;
  setValue: (fieldName: string, value: any) => void;
  values: Record<string, any>;
}

// A form section contains the fields defined for one section of a form
export const FormSection = ({
  uiSpec,
  section,
  setValue,
  values,
}: FormSectionProps) => {
  const sectionSpec = uiSpec.fviews[section];
  if (!sectionSpec) {
    throw new Error(`Section ${section} not found in UISpec`);
  }

  console.log('Section spec:', sectionSpec);

  return (
    <div>
      <h2>Section: {sectionSpec.label}</h2>
      {sectionSpec.fields.map((fieldName: string) => {
        const fieldSpec = uiSpec.fields[fieldName];
        return (
          <Field
            {...fieldSpec['component-parameters']}
            fieldType={fieldSpec['component-name']}
            setValue={(value: any) => setValue(fieldName, value)}
            value={values[fieldName]}
            key={fieldName}
          />
        );
      })}
    </div>
  );
};
