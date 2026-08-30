// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Designer registry of plan types: maps each planType to its label,
 * description, and authoring dialog. Mirrors the runtime plan registry in
 * @faims3/data-model (plans/registry.ts): a Map with lazy built-in
 * installation, so external modules can register additional plan types
 * alongside their data-model registration.
 */

import type {ComponentType} from 'react';
import type {AuthoredPlanTemplate, PlanTemplate} from '@faims3/data-model';
import {
  assertRegistrablePlanType,
  COUNTED_PLAN_TYPE,
  LIST_OF_RECORDS_PLAN_TYPE,
} from '@faims3/data-model';
import {CountedPlanDialog} from './components/plans/CountedPlanDialog';
import {ListOfRecordsPlanDialog} from './components/plans/ListOfRecordsPlanDialog';

/**
 * The uiSpec slice plan dialogs read. Structural, not the designer's
 * NotebookUISpec, so external plan types can implement it.
 */
export type PlanDialogUiSpec = {
  viewsets: Record<string, {label: string; views: string[]} | undefined>;
  views: Record<string, {fields: string[]} | undefined>;
  fields: Record<
    string,
    {'component-parameters'?: {label?: unknown}} | undefined
  >;
};

/** Common props for every plan authoring dialog. */
export type PlanDialogProps = {
  open: boolean;
  /** Forms and fields the dialog picks plan targets from. */
  uiSpec: PlanDialogUiSpec;
  /** Present when editing an existing plan template; absent when creating. */
  initialTemplate?: PlanTemplate;
  /** Labels the template's other plans already carry, which this one may not reuse. */
  takenLabels: string[];
  onClose: () => void;
  /**
   * Called with a schema-valid plan template; the caller stores it and closes.
   * The id is the store's to mint and keep, so a dialog never authors one.
   */
  onSave: (planTemplate: AuthoredPlanTemplate) => void;
};

export type DesignerPlanType = {
  planType: string;
  label: string;
  description: string;
  Dialog: ComponentType<PlanDialogProps>;
};

export type DesignerPlanRegistry = Map<string, DesignerPlanType>;

export const createDesignerPlanRegistry = (): DesignerPlanRegistry => new Map();

// Default registry used at runtime; injectable for testing, as in data-model
const defaultRegistry = createDesignerPlanRegistry();
let builtInsInstalled = false;

export const registerDesignerPlanType = (
  definition: DesignerPlanType,
  registry: DesignerPlanRegistry = defaultRegistry
) => {
  if (registry.has(definition.planType)) {
    throw new Error(
      `Designer plan type ${definition.planType} is already registered`
    );
  }

  assertRegistrablePlanType(definition.planType);

  registry.set(definition.planType, definition);
};

const builtInDesignerPlanTypes: DesignerPlanType[] = [
  {
    planType: COUNTED_PLAN_TYPE,
    label: 'Counted',
    description:
      'Collect a set number of records of one form. The number required is chosen when a notebook is created from this template.',
    Dialog: CountedPlanDialog,
  },
  {
    planType: LIST_OF_RECORDS_PLAN_TYPE,
    label: 'List of Records',
    description:
      'Collect records against a pre-defined list. Choose the form and which of its fields the list pre-fills; the list itself is supplied when a notebook is created.',
    Dialog: ListOfRecordsPlanDialog,
  },
];

// Built-ins install lazily on first lookup, matching data-model's registry
const installBuiltIns = (registry: DesignerPlanRegistry) => {
  if (registry === defaultRegistry && builtInsInstalled) return;
  builtInDesignerPlanTypes.forEach(d => registerDesignerPlanType(d, registry));
  if (registry === defaultRegistry) builtInsInstalled = true;
};

export const getDesignerPlanType = (
  planType: string,
  registry: DesignerPlanRegistry = defaultRegistry
): DesignerPlanType | undefined => {
  if (registry === defaultRegistry) installBuiltIns(registry);
  return registry.get(planType);
};

export const getDesignerPlanTypes = (
  registry: DesignerPlanRegistry = defaultRegistry
): DesignerPlanType[] => {
  if (registry === defaultRegistry) installBuiltIns(registry);
  return [...registry.values()];
};
