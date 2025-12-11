import {ProjectUIModel} from '@faims3/data-model';
import {Field} from '../Field';
import {FormManagerConfig} from '../formManagers';
import {FieldVisibilityMap} from '../formManagers/FormManager';
import {FaimsForm} from '../types';
import {FORCE_IGNORED_FIELDS} from '../../fieldRegistry';

interface FormSectionProps {
  uiSpec: ProjectUIModel;
  section: string;
  form: FaimsForm;
  config: FormManagerConfig;
  /** Visibility information - undefined means full visibility (disabling this
   * feature) */
  fieldVisibilityMap: FieldVisibilityMap | undefined;
}

// A form section contains the fields defined for one section of a form
export const FormSection = ({
  uiSpec,
  section,
  form,
  config,
  fieldVisibilityMap,
}: FormSectionProps) => {
  const sectionSpec = uiSpec.views[section];
  if (!sectionSpec) {
    throw new Error(`Section ${section} not found in UISpec`);
  }

  // Filter for only visible fields
  const visibleFields = sectionSpec.fields.filter(f => {
    // Find the name/namespace
    const spec = uiSpec.fields[f];
    const {name, namespace, hidden} = {
      name: spec['component-name'],
      namespace: spec['component-namespace'],
      hidden: spec['component-parameters']?.hidden === true,
    };

    // Hide if necessary
    if (
      FORCE_IGNORED_FIELDS.find(
        ignored => ignored.name === name && ignored.namespace === namespace
      )
    ) {
      return false;
    }

    // Don't show hidden fields
    if (hidden) {
      return false;
    }

    if (!fieldVisibilityMap) {
      // none provided - disabled feature
      return true;
    }
    // provided - but section missing - not visible - but this should not happen
    if (!fieldVisibilityMap[section]) {
      console.warn(
        'Section was asked to render, but should not be visible - no fields will render.'
      );
      return false;
    }
    // Typical case - is this field present in the visible list?
    return fieldVisibilityMap[section].includes(f);
  });

  return (
    <div>
      {visibleFields.map((fieldName: string) => {
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
