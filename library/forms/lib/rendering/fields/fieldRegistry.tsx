import {ProjectUIModel} from '@faims3/data-model';
import {
  DataViewFieldRegistryEntry,
  DataViewFieldRenderProps,
  FieldRegistry,
  FieldRegistryEntry,
} from '../types';
import {ListWrapper, MapRenderer, StringTypeWrapper} from './view';
import {RelatedRecordRenderer} from './view/specialised/RelatedRecord';
import {TakePhotoRender} from './view/specialised/TakePhoto';

/**
 * The default fallback renderer. Just JSON stringifies the data.
 */
export const DefaultRenderer = (props: DataViewFieldRenderProps) => {
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
const FieldRegistryList: FieldRegistryEntry[] = [
  {
    componentNamespace: 'core-material-ui',
    componentName: 'Input',
    view: {
      component: DefaultRenderer,
      config: {},
    },
  },
  {
    componentNamespace: 'core-material-ui',
    componentName: 'Checkbox',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'core-material-ui',
    componentName: 'TextField',
    view: {component: DefaultRenderer, config: {}},
  },

  // formik-material-ui namespace
  {
    componentNamespace: 'formik-material-ui',
    componentName: 'TextField',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'formik-material-ui',
    componentName: 'Select',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'formik-material-ui',
    componentName: 'RadioGroup',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'formik-material-ui',
    componentName: 'MultipleTextField',
    view: {component: DefaultRenderer, config: {}},
  },

  // faims-custom namespace
  {
    componentNamespace: 'faims-custom',
    componentName: 'Select',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'MultiSelect',
    view: {
      component: props => {
        let content: string[] = [];
        if (Array.isArray(props.value)) {
          content = props.value;
        }
        return <ListWrapper content={content}></ListWrapper>;
      },
      config: {},
    },
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'AdvancedSelect',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'Checkbox',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'RadioGroup',
    view: {component: StringTypeWrapper, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'ActionButton',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'TakePoint',
    view: {component: MapRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'TakePhoto',
    view: {
      component: TakePhotoRender,
      config: {},
      // For attachments, we need to be more careful about this
      attributes: {bypassNullChecks: true},
    },
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'TemplatedStringField',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'BasicAutoIncrementer',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'RelatedRecordSelector',
    view: {
      component: RelatedRecordRenderer,
      config: {},
      attributes: {singleColumn: true},
    },
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'AddressField',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'FileUploader',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'RandomStyle',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'RichText',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'DateTimePicker',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'DatePicker',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'MonthPicker',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'DateTimeNow',
    view: {component: DefaultRenderer, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'FAIMSTextField',
    view: {component: StringTypeWrapper, config: {}},
  },
  {
    componentNamespace: 'faims-custom',
    componentName: 'NumberField',
    view: {component: DefaultRenderer, config: {}},
  },

  // qrcode namespace
  {
    componentNamespace: 'qrcode',
    componentName: 'QRCodeFormField',
    view: {component: DefaultRenderer, config: {}},
  },

  // mapping-plugin namespace
  {
    componentNamespace: 'mapping-plugin',
    componentName: 'MapFormField',
    view: {
      component: MapRenderer,
      config: {},
      attributes: {singleColumn: true},
    },
  },
];

// Build the map from the componentNamespace::componentName to the renderer
// entry
export const FIELD_REGISTRY: FieldRegistry = new Map();
for (const entry of FieldRegistryList) {
  const typeKey = buildKey({
    componentName: entry.componentName,
    componentNamespace: entry.componentNamespace,
  });
  FIELD_REGISTRY.set(typeKey, entry);
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
}): DataViewFieldRegistryEntry | undefined {
  // Build the lookup key
  const fieldConfig = uiSpecification.fields[fieldName];
  const namespace = fieldConfig['component-namespace'];
  const name = fieldConfig['component-name'];
  const typeKey = buildKey({
    componentName: name,
    componentNamespace: namespace,
  });

  return FIELD_REGISTRY.get(typeKey)?.view;
}

const validateRendererRegistry = (registry: FieldRegistry) => {
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
validateRendererRegistry(FIELD_REGISTRY);
