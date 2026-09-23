import {
  buildConditionValues,
  CompiledUiSpecModel,
  compileUiSpecConditionals,
  currentlyVisibleMap,
  RecordContext,
  restrictVisibilityMap,
} from '@faims3/data-model';
import {useForm} from '@tanstack/react-form';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ComponentProps, useCallback, useEffect, useMemo, useState} from 'react';
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
  /**
   * Show only these sections and fields, for a screen hosting part of a form
   * rather than the whole of it. Intersected with what the notebook's own
   * conditions allow, so this can only ever hide more, never reveal.
   */
  restrictTo?: FieldVisibilityMap;
  /**
   * Called with the current values whenever they change, for a host that owns
   * the saving. This manager persists nothing itself, so without it the values
   * an operator enters go nowhere.
   */
  onValuesChange?: (values: FaimsFormData) => void;
}

/**
 * PreviewFormManager - A simplified form manager that renders a form without
 * owning its data.
 *
 * Real fields with real conditions, templated strings and computed values, but
 * no data engine, no navigation and nothing written. Two callers want that:
 * the designer, showing how a form will look and behave, and a screen hosting
 * part of a form, which narrows what renders with `restrictTo` and takes the
 * values back through `onValuesChange` to save them itself.
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

  // Restricted where it is computed, so the one stored map is what renders.
  const restrictIfAsked = useCallback(
    (visibilityMap: FieldVisibilityMap): FieldVisibilityMap =>
      props.restrictTo === undefined
        ? visibilityMap
        : restrictVisibilityMap({visibilityMap, restrictTo: props.restrictTo}),
    [props.restrictTo]
  );

  const [visibleMap, setVisibleMap] = useState<FieldVisibilityMap>(() =>
    restrictIfAsked(
      currentlyVisibleMap({
        values: buildConditionValues({
          values: formDataExtractor({fullData: formValues}),
          context: previewContext,
        }),
        uiSpec: uiSpec,
        viewsetId: props.formName,
      })
    )
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
        props.onValuesChange?.(form.state.values);
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
          restrictIfAsked(
            currentlyVisibleMap({
              values: buildConditionValues({
                values: formDataExtractor({fullData: form.state.values}),
                context: previewContext,
              }),
              uiSpec: uiSpec,
              viewsetId: props.formName,
            })
          )
        );
      },
    },
  });

  // Whenever the uiSpec, formName or metadata changes, recompute the visible fields
  useEffect(() => {
    setVisibleMap(
      restrictIfAsked(
        currentlyVisibleMap({
          values: buildConditionValues({
            values: formDataExtractor({fullData: form.state.values}),
            context: previewContext,
          }),
          uiSpec: uiSpec,
          viewsetId: props.formName,
        })
      )
    );
  }, [props.uiSpec, props.formName, previewContext, restrictIfAsked]);

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
