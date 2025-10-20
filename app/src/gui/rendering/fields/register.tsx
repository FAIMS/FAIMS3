import {RendererRegistry, RenderFunctionComponentProps} from './types';

// TODO this is a registration of field renderers
export const RENDERER_REGISTRY: RendererRegistry = new Map([
  [
    'a',
    {
      config: {},
      type: 'a',
      renderComponent: () => <div>Renderer A</div>,
    },
  ],
]);

const validateRendererRegistry = (registry: RendererRegistry) => {
  for (const [type, entry] of registry) {
    if (type !== entry.type) {
      throw new Error(
        `Renderer registry type mismatch: key "${type}" does not match entry type "${entry.type}"`
      );
    }
  }
};

const DefaultRenderer = (props: RenderFunctionComponentProps) => {
  // Try and json stringify the value for display
  let val = 'Cannot display value';
  try {
    val = JSON.stringify(props.value);
  } catch (e) {
    console.error('Error stringifying value for DefaultRenderer', e);
  }
  return <div>{val}</div>;
};

// Always validate the registry on load
validateRendererRegistry(RENDERER_REGISTRY);
