import {
  FieldSummary,
  getNotebookFieldTypes,
  HydratedDataRecord,
  UISpecification,
} from '@faims3/data-model';
import React, {useMemo} from 'react';
import {RENDERER_REGISTRY} from '../fields/register';
import {RenderFunctionComponent} from '../fields/types';

export interface FormRendererProps {
  viewsetId: string;
  // The UI Spec
  uiSpecification: UISpecification;
  // The hydrated data record
  hydratedRecord: HydratedDataRecord;
  config: {
    // Any configuration options for the form renderer
    // TODO
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
    <div>
      {fieldsByView.entries().map(([viewId, sectionFields]) => {
        return (
          <FormRendererSection
            {...props}
            viewId={viewId}
            sectionFields={sectionFields}
          ></FormRendererSection>
        );
      })}
    </div>
  );
};

export interface FormRendererSectionProps extends FormRendererProps {
  viewId: string;
  sectionFields: FieldSummary[];
}
const FormRendererSection: React.FC<FormRendererSectionProps> = props => {
  return (
    <>
      <h4> Section {props.viewId}</h4>
      {props.sectionFields.map(field => {
        return <FormRendererField {...props} fieldInfo={field} />;
      })}
    </>
  );
};

export interface FormRendererFieldProps extends FormRendererSectionProps {
  fieldInfo: FieldSummary;
}

const FormRendererField: React.FC<FormRendererFieldProps> = props => {
  // Get the data for this field
  const data = useMemo(() => {
    return props.hydratedRecord.data[props.fieldInfo.name];
  }, [props.fieldInfo, props.uiSpecification, props.hydratedRecord]);

  // Get the renderer for the field
  const fieldRenderer: RenderFunctionComponent | undefined = useMemo(() => {
    const renderer = RENDERER_REGISTRY.get(props.fieldInfo.type);
    if (!renderer) {
      console.warn(
        `No renderer found for field type ${props.fieldInfo.type}, using default renderer`
      );
      return undefined;
    }
    return renderer.renderComponent;
  }, []);

  // Return basic display
  return (
    <div>
      {fieldRenderer ? (<fieldRenderer value={data} config={}/>) : (<DefaultRenderer/>)}
    </div>
  );
};
