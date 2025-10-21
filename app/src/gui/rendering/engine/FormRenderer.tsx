import {
  FieldSummary,
  getNotebookFieldTypes,
  RecordMetadata,
  UISpecification,
} from '@faims3/data-model';
import {Box, Stack, Typography} from '@mui/material';
import React, {useMemo} from 'react';
import {DefaultRenderer, getRendererFromFieldConfig} from '../fields/register';
import {RenderContext, RenderFunctionConfiguration} from '../types';
import {EmptyResponsePlaceholder} from '../fields/wrappers';
import {FieldDebugger} from '../fields/specialised/util';
import {currentlyVisibleFields} from '../../../lib/form-utils';

export interface FormRendererProps {
  viewsetId: string;
  // The UI Spec
  uiSpecification: UISpecification;
  // The hydrated data record
  hydratedRecord: RecordMetadata;
  config: {
    debugMode?: boolean;
  };
}
export const FormRenderer: React.FC<FormRendererProps> = props => {
  // List of field info for this viewset
  const fieldInfo: FieldSummary[] = useMemo(() => {
    return getNotebookFieldTypes({
      uiSpecification: props.uiSpecification,
      viewID: props.viewsetId,
    });
  }, [props.uiSpecification]);

  // create map of viewId -> fields
  const fieldsByView: Map<string, FieldSummary[]> = useMemo(() => {
    const viewMap: Map<string, FieldSummary[]> = new Map();
    for (const field of fieldInfo) {
      const viewId = field.viewId;
      const currentList = viewMap.get(viewId) ?? [];
      currentList.push(field);
      viewMap.set(viewId, currentList);
    }
    return viewMap;
  }, [props.uiSpecification]);

  const visibleFields = useMemo(() => {
    return currentlyVisibleFields({
      uiSpec: props.uiSpecification,
      values: props.hydratedRecord.data ?? {},
      viewsetId: props.viewsetId,
    });
  }, [props.uiSpecification, props.hydratedRecord]);

  return (
    <Box sx={{padding: '12px'}}>
      {Array.from(fieldsByView.entries()).map(([viewId, sectionFields]) => {
        return (
          <FormRendererSection
            {...props}
            viewId={viewId}
            // Filter for only visible
            sectionFields={sectionFields.filter(f =>
              visibleFields.includes(f.name)
            )}
            key={viewId}
          ></FormRendererSection>
        );
      })}
    </Box>
  );
};

export interface FormRendererSectionProps extends FormRendererProps {
  viewId: string;
  sectionFields: FieldSummary[];
}
const FormRendererSection: React.FC<FormRendererSectionProps> = props => {
  // Get the section label
  const sectionLabel = props.uiSpecification.views[props.viewId]?.label;

  // filter the section fields based on what should be visible in the form

  return (
    <>
      <h2>{sectionLabel ?? props.viewId}</h2>
      <Stack spacing={2}>
        {props.sectionFields.map(field => {
          return (
            <FormRendererField {...props} fieldInfo={field} key={field.name} />
          );
        })}
      </Stack>
    </>
  );
};

/**
 * Checks if a value (which could be anything) appears to be empty
 * @param val The value to check
 * @returns True iff response is empty
 */
function isResponseEmpty(val: any): boolean {
  return (
    // null case
    val === null ||
    // undefined case
    val === undefined ||
    // empty string response - sometimes happens with text fields or geometries
    (typeof val === 'string' &&
      (val.trim() === '' ||
        // It's worth noting FAIMS sometimes includes the literal string '""' to
        // represent empty values
        val === '""'))
  );
}

export interface FormRendererFieldProps extends FormRendererSectionProps {
  fieldInfo: FieldSummary;
}

const FormRendererField: React.FC<FormRendererFieldProps> = props => {
  // Get the data for this field
  const data = useMemo(() => {
    return props.hydratedRecord.data?.[props.fieldInfo.name];
  }, [props.fieldInfo, props.uiSpecification, props.hydratedRecord]);

  // Get the renderer for the field
  const fieldRenderInfo = useMemo(() => {
    const renderer = getRendererFromFieldConfig({
      uiSpecification: props.uiSpecification,
      fieldName: props.fieldInfo.name,
    });
    if (!renderer) {
      return undefined;
    }
    return renderer;
  }, []);

  const FieldRenderer = fieldRenderInfo?.renderComponent;

  // Grab the UI label for this field
  const uiLabel = useMemo(() => {
    // This is the configured UI label for this field, i.e. the title
    return props.uiSpecification.fields[props.fieldInfo.name]?.[
      'component-parameters'
    ]?.label;
  }, [props.uiSpecification, props.fieldInfo]);

  // hidden when component-parameters.hidden: true
  const isHidden = useMemo(() => {
    return (
      props.uiSpecification.fields[props.fieldInfo.name]?.[
        'component-parameters'
      ]?.hidden === true
    );
  }, [props.uiSpecification, props.fieldInfo]);

  const isEmpty = isResponseEmpty(data);

  // Map state -> render context
  const rendererContext: RenderContext = {
    fieldId: props.fieldInfo.name,
    recordMetadata: props.hydratedRecord,
    viewId: props.viewId,
    viewsetId: props.viewsetId,
    uiSpecification: props.uiSpecification,
  };

  // Debugging content to inject, if configured (config.debugMode)
  const debugContent = props.config.debugMode ? (
    // This is a component which provides a rich expandable menu of all the
    // field context- helpful for developing or debugging fields
    <FieldDebugger {...props} value={data} rendererContext={rendererContext} />
  ) : null;

  // Map config -> render context
  const renderConfig: RenderFunctionConfiguration = {
    debugMode: props.config.debugMode,
  };

  if (isHidden) {
    return null;
  } else {
    // Return the custom renderer for this field
    return (
      <div>
        <Stack direction="column" spacing={1}>
          <Typography variant="h5">{uiLabel}</Typography>
          {debugContent}
          {
            // Note that we check here whether to bypass null checks
          }
          {!fieldRenderInfo?.attributes?.bypassNullChecks && isEmpty ? (
            <EmptyResponsePlaceholder />
          ) : FieldRenderer ? (
            // Render the field with the appropriate renderer
            <FieldRenderer
              value={data}
              config={renderConfig}
              rendererContext={rendererContext}
            />
          ) : (
            // Or use default fallback
            <DefaultRenderer
              value={data}
              config={renderConfig}
              rendererContext={rendererContext}
            />
          )}
        </Stack>
      </div>
    );
  }
};
