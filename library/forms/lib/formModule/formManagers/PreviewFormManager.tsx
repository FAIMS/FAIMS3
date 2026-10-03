import {
  buildConditionValues,
  CompiledUiSpecModel,
  compileUiSpecConditionals,
  currentlyVisibleMap,
  RecordContext,
} from '@faims3/data-model';
import {useForm} from '@tanstack/react-form';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ComponentProps, useEffect, useMemo, useState} from 'react';
import {formDataExtractor} from '../../utils';
import {FaimsFormData} from '../types';
import {FieldVisibilityMap} from './types';
import {onChangeTemplatedFields} from './templatedFields';
import {onChangeComputedFields} from './computedFields';
import {PreviewFormConfig} from './types';
import {MapConfig} from '../../components/maps/types';
import {FormManager} from './FormManager';
import {logInfo} from '../../logging';
const queryClient = new QueryClient();

/**
 * Props for the PreviewFormManager component.
 */
export interface PreviewFormManagerProps extends ComponentProps<any> {
  /** Initial form data */
  initialFormData?: FaimsFormData;
  /** The name/ID of the form to preview */
  formName: string;
  /** Decoded UI spec (`fields`, `views`, `viewsets`, `visible_types`) */
  uiSpec: CompiledUiSpecModel;
  layout: 'tabs' | 'inline';
  mapConfig: () => MapConfig;
  /** Optional section id to focus in tabbed preview mode. */
  previewSectionId?: string;
  /** The notebook's custom metadata, so _METADATA.<key> references work in preview */
  metadataValues?: Record<string, string>;
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
    return spec as CompiledUiSpecModel;
  }, [props.uiSpec]);

  // Fake record context plus real notebook metadata, so metadata references
  // in conditions, templates and expressions behave in preview.
  const previewContext: RecordContext = useMemo(
    () => ({
      createdBy: 'Preview Author',
      createdTime: 1764136061,
      metadataValues: props.metadataValues,
    }),
    [props.metadataValues]
  );

  const [visibleMap, setVisibleMap] = useState<FieldVisibilityMap>(
    currentlyVisibleMap({
      values: buildConditionValues({
        values: formDataExtractor({fullData: formValues}),
        context: previewContext,
      }),
      uiSpec: uiSpec,
      viewsetId: props.formName,
    })
  );

  // Initialize form with mock data and simple logging
  const form = useForm({
    defaultValues: formValues,
    onSubmit: ({value}) => {
      logInfo('Form submitted:', value);
    },
    listeners: {
      onChange: () => {
        logInfo('Form values changed:', form.state.values);
        // Recompute computed fields first so templated strings read fresh values
        onChangeComputedFields({
          form,
          uiSpec: props.uiSpec,
          formId: props.formName,
          runListeners: false,
          context: previewContext,
        });
        // Then fire any updates to the templated fields
        onChangeTemplatedFields({
          form,
          uiSpec: props.uiSpec,
          formId: props.formName,
          // Don't fire listeners again redundantly
          runListeners: false,
          context: previewContext,
        });

        // Updating visibility
        setVisibleMap(
          currentlyVisibleMap({
            values: buildConditionValues({
              values: formDataExtractor({fullData: form.state.values}),
              context: previewContext,
            }),
            uiSpec: uiSpec,
            viewsetId: props.formName,
          })
        );
      },
    },
  });

  // Whenever the uiSpec, formName or metadata changes, recompute the visible fields
  useEffect(() => {
    setVisibleMap(
      currentlyVisibleMap({
        values: buildConditionValues({
          values: formDataExtractor({fullData: form.state.values}),
          context: previewContext,
        }),
        uiSpec: uiSpec,
        viewsetId: props.formName,
      })
    );
  }, [props.uiSpec, props.formName, previewContext]);

  // Preview mode config (no backend integration)
  const config: PreviewFormConfig = {
    mode: 'preview' as const,
    platform: 'web',
    layout: props.layout,
    mapConfig: props.mapConfig,
    previewSectionId: props.previewSectionId,
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
