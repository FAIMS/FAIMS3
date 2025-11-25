import {UISpecification} from '@faims3/data-model';
import {FormManagerConfig} from '../formManagers';
import {FaimsForm} from '../types';
import {FormSection} from './FormSection';
import {FieldVisibilityMap} from '../formManagers/FormManager';

/**
 * InlineSectionDisplay
 * Renders all sections vertically stacked (traditional long form).
 */
export const InlineSectionDisplay: React.FC<{
  form: FaimsForm;
  formId: string;
  spec: UISpecification;
  config: FormManagerConfig;
  /** Visibility information - undefined means full visibility (disabling this
   * feature) */
  fieldVisibilityMap: FieldVisibilityMap | undefined;
}> = props => {
  const formSpec = props.spec.viewsets[props.formId];
  const visibleViews = props.fieldVisibilityMap
    ? Object.keys(props.fieldVisibilityMap)
    : undefined;
  return (
    <>
      {formSpec.views.map((sectionName: string) => {
        const label = props.spec.views[sectionName].label ?? sectionName;
        if (visibleViews ? visibleViews.includes(sectionName) : true) {
          return (
            <>
              <h2>Section: {label}</h2>
              <FormSection
                key={sectionName}
                form={props.form}
                uiSpec={props.spec}
                section={sectionName}
                config={props.config}
                fieldVisibilityMap={props.fieldVisibilityMap}
              />
            </>
          );
        } else {
          // Not visible
          return null;
        }
      })}
    </>
  );
};
