import {UISpecification} from '@faims3/data-model';
import {FormManagerConfig} from '../formManagers';
import {FaimsForm} from '../types';
import {FormSection} from './FormSection';

/**
 * InlineSectionDisplay
 * Renders all sections vertically stacked (traditional long form).
 */
export const InlineSectionDisplay: React.FC<{
  form: FaimsForm;
  formId: string;
  spec: UISpecification;
  config: FormManagerConfig;
}> = props => {
  const formSpec = props.spec.viewsets[props.formId];
  return (
    <>
      {formSpec.views.map((sectionName: string) => {
        const label = props.spec.views[sectionName].label ?? sectionName;
        return (
          <>
            <h2>Section: {label}</h2>
            <FormSection
              key={sectionName}
              form={props.form}
              uiSpec={props.spec}
              section={sectionName}
              config={props.config}
            />
          </>
        );
      })}
    </>
  );
};
