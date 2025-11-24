import {ProjectUIModel} from '@faims3/data-model';
import {Field} from './Field';
import {FormManagerConfig} from './formManagers';
import {FaimsForm} from './types';

interface FormSectionProps {
  uiSpec: ProjectUIModel;
  section: string;
  form: FaimsForm;
  config: FormManagerConfig;
}

// A form section contains the fields defined for one section of a form
export const FormSection = ({
  uiSpec,
  section,
  form,
  config,
}: FormSectionProps) => {
  const sectionSpec = uiSpec.views[section];
  if (!sectionSpec) {
    throw new Error(`Section ${section} not found in UISpec`);
  }

  return (
    <div>
      <h2>Section: {sectionSpec.label}</h2>
      {sectionSpec.fields.map((fieldName: string) => {
        const fieldSpec = uiSpec.fields[fieldName];
        return (
          <Field
            fieldId={fieldName}
            form={form}
            fieldSpec={fieldSpec}
            key={fieldName}
            config={config}
          />
        );
      })}
    </div>
  );
};
