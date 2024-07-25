/*
 * Copyright 2021, 2022 Macquarie University
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
  FormComponentList,
} from 'faims3-datamodel';

const componentRegistry: ComponentRegistry = {};

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

export function registerField(
  namespace: string,
  component_name: string,
  human_readable_name: string,
  description: string,
  category: string,
  component: FAIMSFormField
) {
  const n = getNameSpace(namespace);
  n[component_name] = {
    human_readable_name: human_readable_name,
    description: description,
    category: category,
    component: component,
    // below were used in the form builder, no longer needed
    settingsProps: [],
    uiSpecProps: null,
    builder_component: null,
    icon: null,
  };
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
