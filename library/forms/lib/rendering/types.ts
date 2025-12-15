import {
  DataEngine,
  FaimsAttachments,
  FormAnnotation,
  FormUpdateData,
  HydratedRecordDocument,
  IAttachmentService,
  ProjectUIModel,
  UISpecification,
} from '@faims3/data-model';
import {MapConfig} from '..';

export type DataViewTraceEntry = {
  // ID of the record
  recordId: string;
  // The viewsetID called from
  viewsetId: string;
  // The view ID called from
  viewId: string;
  // Which field called this form?
  fieldId: string;
  // Call type - at the moment only related records call out
  callType: 'relatedRecord';
};

export type DataViewTools = {
  navigateToRecord: (params: {recordId: string; revisionId?: string}) => void;
  getRecordRoute: (params: {recordId: string; revisionId?: string}) => string;
  getDataEngine: () => DataEngine;
  getAttachmentService: () => IAttachmentService;
  getMapConfig: () => MapConfig;
  // A react component which can be used to render an edit button in a
  // collapsible nested related record
  editRecordButtonComponent: React.FC<{recordId: string}>;
};

export interface DataViewProps {
  // The form ID
  viewsetId: string;
  // The UI Spec
  uiSpecification: UISpecification;
  // The hydrated data record (for context)
  hydratedRecord: HydratedRecordDocument;
  // The record HRID
  hrid: string;
  // The full form data
  formData: FormUpdateData;
  config: {
    debugMode?: boolean;
  };
  // track history
  trace: DataViewTraceEntry[];
  // Controls/triggers
  tools: DataViewTools;
}

// A renderer function component
export type DataViewFieldRenderProps = {
  // Value - this is a controlled component - will re-render on value change. A
  // component may wish to cast this to their own known data type for usage
  value: any;
  annotation?: FormAnnotation;
  attachments: FaimsAttachments;
  // Configuration for this renderer (this is available in the function body)
  config: DataViewFieldRenderConfiguration;
  // Additional contextual information, which helps more specialised types
  // reason about how to render
  renderContext: DataViewFieldRenderContext;
};

export type DataViewFieldRender = React.FC<DataViewFieldRenderProps>;

export type DataViewFieldRenderContext = {
  // The viewsetId
  viewsetId: string;
  // The view/section ID
  viewId: string;
  // The field name/ID
  fieldId: string;
  // The record HRID
  hrid: string;
  // The full RecordMetadata object, which may help with more advanced types
  record: HydratedRecordDocument;
  // UI specification
  uiSpecification: ProjectUIModel;
  // The form render trace (to help build new entries)
  trace: DataViewTraceEntry[];
  // Controls/triggers
  tools: DataViewTools;
  // The full form data if needed
  formData: FormUpdateData;
  // Name and namespace
  fieldName: string;
  fieldNamespace: string;
};

// TODO consider configuration we may need
export type DataViewFieldRenderConfiguration = {
  // Should this component be rendering in debug mode?
  debugMode?: boolean;
};

export type DataViewFieldRenderAttributes = {
  // If true, then the renderer will always be called, even if the default null
  // check suggests it shouldn't
  bypassNullChecks?: boolean;
  // Default layout is two column, but this allows forcing to single column e.g.
  // for map / related
  singleColumn?: boolean;
};

export type DataViewFieldRegistryEntry = {
  // The React component that will render this field
  component: DataViewFieldRender;
  // Any other configuration about how this should be rendered
  config: DataViewFieldRenderConfiguration;
  // Attributes/info about this renderer - can inform behaviour
  attributes?: DataViewFieldRenderAttributes;
};
