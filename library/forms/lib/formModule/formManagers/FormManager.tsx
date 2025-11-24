import type {ProjectUIModel} from '@faims3/data-model';
import {type ComponentProps} from 'react';
import {InlineSectionDisplay} from '../sections/InlineSections';
import {TabbedSectionDisplay} from '../sections/TabbedSections';
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
  const formSpec = props.uiSpec.viewsets[props.formName];

  return (
    <>
      <h1>Form: {formSpec.label}</h1>
      <form
        onSubmit={e => {
          e.preventDefault();
          e.stopPropagation();
          props.form.handleSubmit();
        }}
      >
        {/* Render Inline (Vertical) Layout */}
        {props.config.layout === 'inline' && (
          <InlineSectionDisplay
            config={props.config}
            form={props.form}
            formId={props.formName}
            spec={props.uiSpec}
          />
        )}

        {/* Render Tabbed (Horizontal) Layout */}
        {props.config.layout === 'tabs' && (
          <TabbedSectionDisplay
            config={props.config}
            form={props.form}
            formId={props.formName}
            spec={props.uiSpec}
          />
        )}
      </form>

      {/* Debug display of current form state */}
      <FormStateDisplay form={props.form} />
    </>
  );
};
