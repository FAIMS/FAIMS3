/**
 * @file Types and label helpers shared by plan config forms and the registry.
 * Kept free of component imports so forms can use them without a cycle.
 */

import type {ComponentType} from 'react';
import type {PlanTemplate} from '@faims3/data-model';

/** Instantiation-time config; validated server-side against the plan type's configSchema. */
export type PlanConfig = Record<string, unknown>;

/** The uiSpec slice config forms read. Structural so external plan types can implement it. */
export type PlanConfigUiSpec = {
  viewsets: Record<string, {label?: string; views: string[]} | undefined>;
  views: Record<string, {fields: string[]} | undefined>;
  fields: Record<
    string,
    | {'component-parameters'?: {label?: unknown}; 'type-returned'?: string}
    | undefined
  >;
};

export type PlanConfigFormProps = {
  template: PlanTemplate;
  uiSpec: PlanConfigUiSpec;
  /** Called with a schema-valid config, or undefined while incomplete or invalid. */
  onChange: (config: PlanConfig | undefined) => void;
};

export type PlanConfigType = {
  planType: string;
  label: string;
  ConfigForm: ComponentType<PlanConfigFormProps>;
};

/** Display label for a form id, falling back to the id. */
export const formLabel = (uiSpec: PlanConfigUiSpec, formType: string) =>
  uiSpec.viewsets[formType]?.label || formType;

/** Display label for a field id, falling back to the id. */
export const fieldLabel = (uiSpec: PlanConfigUiSpec, fieldName: string) => {
  const label = uiSpec.fields[fieldName]?.['component-parameters']?.label;
  return typeof label === 'string' && label ? label : fieldName;
};
