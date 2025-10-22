import {ProjectUIModel} from '@faims3/data-model';
import {
  FieldRendererEntry,
  RendererRegistry,
  RenderFunctionComponentProps,
} from '../types';
import {ListWrapper, StringTypeWrapper, TextWrapper} from './wrappers';
import {MapRenderer} from './specialised/Mapping';
import {TakePhotoRender} from './specialised/TakePhoto';
import {RelatedRecordRenderer} from './specialised/RelatedRecord';

/**
 * The default fallback renderer. Just JSON stringifies.
 */
export const DefaultRenderer = (props: RenderFunctionComponentProps) => {
  // Try and json stringify the value for display
  let val = 'Cannot display value';
  try {
    val = JSON.stringify(props.value);
  } catch (e) {
    console.error('Error stringifying value for DefaultRenderer', e);
  }
  return <div>{val}</div>;
};

// NOTE: This is the list of all supported field renderers. To add a new
// renderer, add it here.
const FieldRendererList: FieldRendererEntry[] = [
  {
    componentNamespace: 'core-material-ui',
    componentName: 'Input',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'core-material-ui',
    componentName: 'Checkbox',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'core-material-ui',
    componentName: 'TextField',
    renderComponent: DefaultRenderer,
    config: {},
  },

  // formik-material-ui namespace
  {
    componentNamespace: 'formik-material-ui',
    componentName: 'TextField',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'formik-material-ui',
    componentName: 'Select',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'formik-material-ui',
    componentName: 'RadioGroup',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'formik-material-ui',
    componentName: 'MultipleTextField',
    renderComponent: DefaultRenderer,
    config: {},
  },

  // faims-custom namespace
  {
    componentNamespace: 'faims-custom',
    componentName: 'Select',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'MultiSelect',
    renderComponent: props => {
      let content: string[] = [];
      if (Array.isArray(props.value)) {
        content = props.value;
      }
      return <ListWrapper content={content}></ListWrapper>;
    },
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'AdvancedSelect',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'Checkbox',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'RadioGroup',
    renderComponent: StringTypeWrapper,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'ActionButton',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'TakePoint',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'TakePhoto',
    renderComponent: TakePhotoRender,
    config: {},
    // For attachments, we need to be more careful about this
    attributes: {bypassNullChecks: true},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'TemplatedStringField',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'BasicAutoIncrementer',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'RelatedRecordSelector',
    renderComponent: RelatedRecordRenderer,
    config: {},
    attributes: {singleColumn: true},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'AddressField',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'FileUploader',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'RandomStyle',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'RichText',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'DateTimePicker',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'DatePicker',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'MonthPicker',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'DateTimeNow',
    renderComponent: DefaultRenderer,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'FAIMSTextField',
    renderComponent: StringTypeWrapper,
    config: {},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'NumberField',
    renderComponent: DefaultRenderer,
    config: {},
  },

  // qrcode namespace
  {
    componentNamespace: 'qrcode',
    componentName: 'QRCodeFormField',
    renderComponent: DefaultRenderer,
    config: {},
  },

  // mapping-plugin namespace
  {
    componentNamespace: 'mapping-plugin',
    componentName: 'MapFormField',
    renderComponent: MapRenderer,
    config: {},
    attributes: {singleColumn: true},
  },

  // DEPRECATED/UNUSED - okay to use default renderer for now
  // ========================================================
];

// Build the map from the componentNamespace::componentName to the renderer
// entry
export const RENDERER_REGISTRY: RendererRegistry = new Map();
for (const entry of FieldRendererList) {
  const typeKey = buildKey({
    componentName: entry.componentName,
    componentNamespace: entry.componentNamespace,
  });
  RENDERER_REGISTRY.set(typeKey, entry);
}

// Internal helper to build the registry key
function buildKey({
  componentName,
  componentNamespace,
}: {
  componentNamespace: string;
  componentName: string;
}): string {
  return `${componentNamespace}::${componentName}`;
}

// Internal helper to split the registry key
function splitKey(typeKey: string): {
  componentNamespace: string;
  componentName: string;
} {
  const parts = typeKey.split('::');
  if (parts.length !== 2) {
    throw new Error(`Invalid type key: ${typeKey}`);
  }
  return {
    componentNamespace: parts[0],
    componentName: parts[1],
  };
}

/**
 * Get the renderer entry from the field config
 * @param uiSpecification The UI specification
 * @param fieldName The field name to get the renderer for (must exist in
 * uiSpecification)
 * @returns The renderer entry, or undefined if not found
 */
export function getRendererFromFieldConfig({
  uiSpecification,
  fieldName,
}: {
  uiSpecification: ProjectUIModel;
  fieldName: string;
}): FieldRendererEntry | undefined {
  // Build the lookup key
  const fieldConfig = uiSpecification.fields[fieldName];
  const namespace = fieldConfig['component-namespace'];
  const name = fieldConfig['component-name'];
  const typeKey = buildKey({
    componentName: name,
    componentNamespace: namespace,
  });

  return RENDERER_REGISTRY.get(typeKey);
}

const validateRendererRegistry = (registry: RendererRegistry) => {
  for (const [type, entry] of registry) {
    const {componentNamespace, componentName} = splitKey(type);
    if (
      componentNamespace !== entry.componentNamespace ||
      componentName !== entry.componentName
    ) {
      throw new Error(
        `Renderer registry key mismatch: key "${type}" does not match entry namespace "${entry.componentNamespace}" and name "${entry.componentName}"`
      );
    }
  }
};

// Always validate the registry on load
validateRendererRegistry(RENDERER_REGISTRY);
