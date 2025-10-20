// This is the types for rendering a field

// A renderer function component
export type RenderFunctionComponentProps = {
  // Value - this is a controlled component - will re-render on value change. A
  // component may wish to cast this to their own known data type for usage
  value: any;
  // Configuration for this renderer
  config: RenderConfiguration;
};

export type RenderFunctionComponent = React.FC<RenderFunctionComponentProps>;

// TODO consider configuration we may need
export type RenderConfiguration = {};

export type FieldRendererEntry = {
  // What is the type of field e.g. FAIMS::FaimsTextField
  type: string;
  // The React component that will render this field
  renderComponent: RenderFunctionComponent;
  // Any other configuration about how this should be rendered
  config: RenderConfiguration;
};

// Maps the field type -> to the renderer entry
export type RendererRegistry = Map<string, FieldRendererEntry>;
