/*
 * Copyright 2021 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: ComponentRegistry.ts
 * Description:
 *   TODO
 */

import {
  ComponentRegistry,
  ComponentRegistryProperties,
  FAIMSFormField,
  FAIMSBuilderFormField,
  FAIMSBuilderIcon,
  FAIMSUiSpec,
  FormComponentList,
} from '../../datamodel/ui';
import {getDefaultBuilderComponent, getDefaultBuilderIcon,getDefaultuiSpecProps} from './defaults';

const componentRegistry: ComponentRegistry = {};

//export function NoSuchComponentNamespace(message: string) {
//    this.message = message;
//    this.name = 'NoSuchComponentNamespace';
//}
//
//export function NoSuchComponent(message: string) {
//    this.message = message;
//    this.name = 'NoSuchComponent';
//}

export function getComponentByName(namespace: string, componentName: string) {
  if (componentRegistry[namespace] === undefined) {
    throw new Error(`Unknown namespace ${namespace}`);
  }
  if (componentRegistry[namespace][componentName] === undefined) {
    throw new Error(`No component ${componentName} in namespace ${namespace}`);
  }
  return componentRegistry[namespace][componentName].component;
}

export function getComponentPropertiesByName(
  namespace: string,
  componentName: string
): ComponentRegistryProperties {
  if (componentRegistry[namespace] === undefined) {
    throw new Error(`Unknown namespace ${namespace}`);
  }
  if (componentRegistry[namespace][componentName] === undefined) {
    throw new Error(`No component ${componentName} in namespace ${namespace}`);
  }
  return componentRegistry[namespace][componentName];
}

export function registerComponent(
  namespace: string,
  component_name: string,
  component_properties: ComponentRegistryProperties
) {
  const n = getNameSpace(namespace);
  n[component_name] = component_properties;
}

export function setupComponentProperties(
  human_readable_name: string,
  description: string,
  category: string,
  component: FAIMSFormField,
  uiSpecProps:FAIMSUiSpec |null = null,
  settings:FAIMSUiSpec |null = null,
  builder_component: FAIMSBuilderFormField | null = null,
  icon: FAIMSBuilderIcon | null = null
): ComponentRegistryProperties {
  const props: ComponentRegistryProperties = {
    human_readable_name: human_readable_name,
    description: description,
    category: category,
    component: component,
    builder_component:
      builder_component !== null
        ? builder_component
        : getDefaultBuilderComponent(),
    icon: icon !== null ? icon : getDefaultBuilderIcon(),
    uiSpecProps: uiSpecProps!==null? uiSpecProps: getDefaultuiSpecProps(),
    settings: settings!==null?settings:{},
  };
  return props;
}

function getNameSpace(namespace: string) {
  if (componentRegistry[namespace] === undefined) {
    componentRegistry[namespace] = {};
  }
  return componentRegistry[namespace];
}

export function getAvailableComponents(): FormComponentList {
  const components: FormComponentList = [];
  for (const namespace in componentRegistry) {
    for (const component_name in componentRegistry[namespace]) {
      components.push({
        namespace: namespace,
        component_name: component_name,
        component_properties: componentRegistry[namespace][component_name],
      });
    }
  }
  return components;
}
