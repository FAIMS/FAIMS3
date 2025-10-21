import {
  FieldSummary,
  getNotebookFieldTypes,
  RecordMetadata,
  UISpecification,
} from '@faims3/data-model';
import React, {useMemo} from 'react';
import {
  DefaultRenderer,
  getRendererFromFieldConfig,
  RENDERER_REGISTRY,
} from '../fields/register';
import {RenderFunctionComponent} from '../fields/types';
import {Box, Stack, Typography} from '@mui/material';
import {getSummaryFieldInformation} from '../../../uiSpecification';

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

  return (
    <Box sx={{padding: '12px'}}>
      {Array.from(fieldsByView.entries()).map(([viewId, sectionFields]) => {
        return (
          <FormRendererSection
            {...props}
            viewId={viewId}
            sectionFields={sectionFields}
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

export interface FormRendererFieldProps extends FormRendererSectionProps {
  fieldInfo: FieldSummary;
}

const FormRendererField: React.FC<FormRendererFieldProps> = props => {
  // Get the data for this field
  const data = useMemo(() => {
    return props.hydratedRecord.data?.[props.fieldInfo.name];
  }, [props.fieldInfo, props.uiSpecification, props.hydratedRecord]);

  // Get the renderer for the field
  const FieldRenderer: RenderFunctionComponent | undefined = useMemo(() => {
    const renderer = getRendererFromFieldConfig({
      uiSpecification: props.uiSpecification,
      fieldName: props.fieldInfo.name,
    });
    if (!renderer) {
      return undefined;
    }
    return renderer.renderComponent;
  }, []);

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

  // Debugging content to inject, if configured (config.debugMode)
  const debugContent = props.config.debugMode ? (
    <Typography variant="caption" color="gray">
      <Stack direction="column">
        <span>Field Name: {props.fieldInfo.name}</span>
        <span>Type Key: {props.fieldInfo.type}</span>
        <span>Data: {JSON.stringify(data)}</span>
        <span>
          Namespace:{' '}
          {
            props.uiSpecification.fields[props.fieldInfo.name]?.[
              'component-namespace'
            ]
          }
        </span>
        <span>
          Name:{' '}
          {props.uiSpecification.fields[props.fieldInfo.name]['component-name']}
        </span>
      </Stack>
    </Typography>
  ) : null;

  if (isHidden) {
    return null;
  } else {
    // Return the custom renderer for this field
    return (
      <div>
        <Stack direction="column" spacing={1}>
          <Typography variant="h5">{uiLabel}</Typography>
          {debugContent}
          {FieldRenderer ? (
            // Render the field with the appropriate renderer
            <FieldRenderer value={data} config={props.config} />
          ) : (
            // Or use default fallback
            <DefaultRenderer config={props.config} value={data} />
          )}
        </Stack>
      </div>
    );
  }
};
