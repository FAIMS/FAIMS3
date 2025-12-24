import {
  compileUiSpecConditionals,
  currentlyVisibleMap,
  ProjectUIModel,
} from '@faims3/data-model';
import {useForm} from '@tanstack/react-form';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ComponentProps, useEffect, useMemo, useState} from 'react';
import {formDataExtractor} from '../../utils';
import {FaimsFormData} from '../types';
import {FieldVisibilityMap} from './types';
import {onChangeTemplatedFields} from './templatedFields';
import {PreviewFormConfig} from './types';
import {MapConfig} from '../../components/maps/types';
import {FormManager} from './FormManager';
const queryClient = new QueryClient();

/**
 * Props for the PreviewFormManager component.
 */
export interface PreviewFormManagerProps extends ComponentProps<any> {
  /** Initial form data */
  initialFormData?: FaimsFormData;
  /** The name/ID of the form to preview */
  formName: string;
  /** The UI specification containing form structure */
  uiSpec: ProjectUIModel;
  layout: 'tabs' | 'inline';
  mapConfig: () => MapConfig;
}

/**
 * PreviewFormManager - A simplified form manager for previewing forms.
 *
 * Used in contexts like the form designer where we want to show how a form
 * will look and behave, but without backend integration or data persistence.
 * Uses mock/test data for demonstration purposes.
 */
export const PreviewFormManager = (props: PreviewFormManagerProps) => {
  const formValues =
    props.initialFormData === undefined ? {} : props.initialFormData;
  const uiSpec = useMemo(() => {
    const spec = {...props.uiSpec};
    compileUiSpecConditionals(spec);
    return spec;
  }, [props.uiSpec]);

  const [visibleMap, setVisibleMap] = useState<FieldVisibilityMap>(
    currentlyVisibleMap({
      values: formDataExtractor({
        fullData: formValues,
      }),
      uiSpec: uiSpec,
      viewsetId: props.formName,
    })
  );

  // Initialize form with mock data and simple logging
  const form = useForm({
    defaultValues: formValues,
    onSubmit: ({value}) => {
      console.log('Form submitted:', value);
    },
    listeners: {
      onChange: () => {
        console.log('Form values changed:', form.state.values);
        // First, lets fire any updates to the templated fields
        onChangeTemplatedFields({
          form,
          uiSpec: props.uiSpec,
          formId: props.formName,
          // Don't fire listeners again redundantly
          runListeners: false,
          // Fake context
          context: {createdBy: 'Preview Author', createdTime: 1764136061},
        });

        // Updating visibility
        setVisibleMap(
          currentlyVisibleMap({
            values: formDataExtractor({fullData: form.state.values}),
            uiSpec: uiSpec,
            viewsetId: props.formName,
          })
        );
      },
    },
  });

  // Whenever the uiSpec changes, recompute the visible fields
  useEffect(() => {
    // Updating visibility
    setVisibleMap(
      currentlyVisibleMap({
        values: formDataExtractor({fullData: form.state.values}),
        uiSpec: uiSpec,
        viewsetId: props.formName,
      })
    );
  }, [props.uiSpec]);

  // Preview mode config (no backend integration)
  const config: PreviewFormConfig = {
    mode: 'preview' as const,
    platform: 'web',
    layout: props.layout,
    mapConfig: props.mapConfig,
  };

  return (
    <QueryClientProvider client={queryClient}>
      <FormManager
        form={form}
        formName={props.formName}
        uiSpec={uiSpec}
        config={config}
        fieldVisibilityMap={visibleMap}
      />
    </QueryClientProvider>
  );
};
