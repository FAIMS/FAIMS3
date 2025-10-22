// This is the types for rendering a field

import {ProjectUIModel, RecordMetadata} from '@faims3/data-model';
import { FormRendererTrace } from './engine';

// A renderer function component
export type RenderFunctionComponentProps = {
  // Value - this is a controlled component - will re-render on value change. A
  // component may wish to cast this to their own known data type for usage
  value: any;
  // Configuration for this renderer (this is available in the function body)
  config: RenderFunctionConfiguration;
  // Additional contextual information, which helps more specialised types
  // reason about how to render
  rendererContext: RenderContext;
};

export type RenderFunctionComponent = React.FC<RenderFunctionComponentProps>;

export type RenderContext = {
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
  trace: FormRendererTrace[]
};

// TODO consider configuration we may need
export type RenderFunctionConfiguration = {
  // Should this component be rendering in debug mode?
  debugMode?: boolean;
};

export type RendererAttributes = {
  // If true, then the renderer will always be called, even if the default null
  // check suggests it shouldn't
  bypassNullChecks?: boolean;
  // Default layout is two column, but this allows forcing to single column e.g.
  // for map / related
  singleColumn?: boolean;
};

export type FieldRendererEntry = {
  // Namespace and name (combination uniquely identifies the field type)
  componentNamespace: string;
  componentName: string;

  // The React component that will render this field
  renderComponent: RenderFunctionComponent;
  // Any other configuration about how this should be rendered
  config: RenderFunctionConfiguration;
  // Attributes/info about this renderer - can inform behaviour
  attributes?: RendererAttributes;
};

// Maps the field type -> to the renderer entry
export type RendererRegistry = Map<string, FieldRendererEntry>;
