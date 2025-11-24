import type {ProjectUIModel} from '@faims3/data-model';
import {type ComponentProps} from 'react';
import {FormSection} from '../FormSection';
import {FaimsForm} from '../types';
import {FormStateDisplay} from './FormStateDisplay';
import {FormManagerConfig} from './types';

/**
 * Props for the base FormManager component.
 */
export interface FormManagerProps extends ComponentProps<any> {
  /** The name/ID of the form to render */
  formName: string;
  /** TanStack Form instance managing form state */
  form: FaimsForm;
  /** UI specification containing form structure and field definitions */
  uiSpec: ProjectUIModel;
  /** Configuration determining form mode and available features */
  config: FormManagerConfig;
}

/**
 * FormManager - Base form rendering component.
 *
 * This component handles the actual rendering of form sections and fields
 * based on the UI specification. It's used by both EditableFormManager
 * (full mode) and PreviewFormManager (preview mode).
 *
 * The form structure is defined in the uiSpec, which maps form names to
 * viewsets containing sections (views), which in turn contain fields.
 */
export const FormManager = (props: FormManagerProps) => {
  // Get the form specification from the UI spec
  const formSpec = props.uiSpec.viewsets[props.formName];

  return (
    <>
      <h2>Form: {formSpec.label}</h2>

      <form
        onSubmit={e => {
          e.preventDefault();
          e.stopPropagation();
          props.form.handleSubmit();
        }}
      >
        {/* Render each section defined in the form spec */}
        {formSpec.views.map((sectionName: string) => (
          <FormSection
            key={sectionName}
            form={props.form}
            uiSpec={props.uiSpec}
            section={sectionName}
            config={props.config}
          />
        ))}
      </form>

      {/* Debug display of current form state */}
      <FormStateDisplay form={props.form} />
    </>
  );
};
