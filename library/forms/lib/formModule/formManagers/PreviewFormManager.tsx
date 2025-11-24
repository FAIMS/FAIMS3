import {ProjectUIModel} from '@faims3/data-model';
import {useForm} from '@tanstack/react-form';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ComponentProps} from 'react';
import {FaimsFormData} from '../types';
import {FormManager} from './FormManager';
import {PreviewFormConfig} from './types';

// Basic query client for use in the preview form manager
const queryClient = new QueryClient();

/**
 * Props for the PreviewFormManager component.
 */
export interface PreviewFormManagerProps extends ComponentProps<any> {
  /** The name/ID of the form to preview */
  formName: string;
  /** The UI specification containing form structure */
  uiSpec: ProjectUIModel;
  layout: 'tabs' | 'inline';
}

/**
 * PreviewFormManager - A simplified form manager for previewing forms.
 *
 * Used in contexts like the form designer where we want to show how a form
 * will look and behave, but without backend integration or data persistence.
 * Uses mock/test data for demonstration purposes.
 */
export const PreviewFormManager = (props: PreviewFormManagerProps) => {
  // Mock form values for preview
  const formValues: FaimsFormData = {
    'Full-Name': {data: 'Steve'},
    Occupation: {data: 'Developer'},
  };

  // Initialize form with mock data and simple logging
  const form = useForm({
    defaultValues: formValues as FaimsFormData,
    onSubmit: ({value}) => {
      console.log('Form submitted:', value);
    },
    listeners: {
      onChange: () => {
        console.log('Form values changed:', form.state.values);
      },
    },
  });

  // Preview mode config (no backend integration)
  const config: PreviewFormConfig = {
    mode: 'preview' as const,
    layout: props.layout,
  };

  return (
    <QueryClientProvider client={queryClient}>
      <FormManager
        form={form}
        formName={props.formName}
        uiSpec={props.uiSpec}
        config={config}
      />
    </QueryClientProvider>
  );
};
