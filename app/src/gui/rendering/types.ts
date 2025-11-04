// This is the types for rendering a field

import {ProjectUIModel, RecordMetadata} from '@faims3/data-model';
import {DataViewTrace as DataViewFieldTrace} from './DataView';

// A renderer function component
export type DataViewFieldRenderProps = {
  // Value - this is a controlled component - will re-render on value change. A
  // component may wish to cast this to their own known data type for usage
  value: any;
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
  // The full RecordMetadata object, which may help with more advanced types
  recordMetadata: RecordMetadata;
  // UI specification
  uiSpecification: ProjectUIModel;
  // The form render trace (to help build new entries)
  trace: DataViewFieldTrace[];
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

export type FieldRegistryEntry = {
  // Namespace and name (combination uniquely identifies the field type)
  componentNamespace: string;
  componentName: string;

  // The view entry
  view: DataViewFieldRegistryEntry;

  // TODO - form entry?
  // form: FormFieldRegistryEntry
};

// Maps the field type -> to the renderer entry
export type FieldRegistry = Map<string, FieldRegistryEntry>;
