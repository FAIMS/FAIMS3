import {UISpecification} from '@faims3/data-model';
import {FormManagerConfig} from '../formManagers';
import {FaimsForm} from '../types';
import {FormSection} from './FormSection';
import {FieldVisibilityMap} from '../formManagers/FormManager';
import {useEffect} from 'react';
import {getFieldId} from '../utils';
import {Typography} from '@mui/material';

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
  useEffect(() => {
    // When we first mount the component, if we have a valid nav context then we
    // should scroll to this field
    if (props.config.mode === 'full') {
      if (props.config.navigationContext.scrollTarget !== undefined) {
        const targetFieldId =
          props.config.navigationContext.scrollTarget.fieldId;
        const scrollId = getFieldId({fieldId: targetFieldId});
        const timeout = setTimeout(() => {
          const ref = document.getElementById(scrollId);
          if (ref) {
            ref.scrollIntoView({behavior: 'smooth'});
          }
        }, 500);
        return () => {
          clearTimeout(timeout);
        };
      }
    }
  }, []);

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
              <Typography variant={'h4'}>Section: {label}</Typography>
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
