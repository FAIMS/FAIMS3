/**
 * @file Types and label helpers shared by plan config forms and the registry.
 * Kept free of component imports so forms can use them without a cycle.
 */

import type {ComponentType} from 'react';
import type {PlanTemplate} from '@faims3/data-model';
import type {Field} from '@/components/form';

/** Instantiation-time config; validated server-side against the plan type's configSchema. */
export type PlanConfig = Record<string, unknown>;

type PlanConfigField = {
  'component-parameters'?: {label?: unknown};
  'type-returned'?: string;
};

/** The uiSpec slice config forms read. Structural so external plan types can implement it. */
export type PlanConfigUiSpec = {
  viewsets: Record<string, {label?: string; views: string[]} | undefined>;
  views: Record<string, {fields: string[]} | undefined>;
  fields: Record<string, PlanConfigField | undefined>;
};

/** What a field-based plan type is handed to build its fields. */
export type PlanConfigContext = {
  template: PlanTemplate;
  uiSpec: PlanConfigUiSpec;
  /** Prefix for this plan's field names; unique per plan within the form. */
  prefix: string;
};

export type PlanConfigFormProps = {
  template: PlanTemplate;
  uiSpec: PlanConfigUiSpec;
  /** Called with a schema-valid config, or undefined while incomplete or invalid. */
  onChange: (config: PlanConfig | undefined) => void;
};

/**
 * A plan type either contributes fields to the create form (validated and
 * styled by Form) or, when its input is too custom for that, renders its own
 * component in the form's footer and reports a schema-valid config.
 */
export type PlanConfigType = {planType: string; label: string} & (
  | {
      fields: (context: PlanConfigContext) => Field[];
      toConfig: (values: Record<string, unknown>, prefix: string) => PlanConfig;
    }
  | {ConfigForm: ComponentType<PlanConfigFormProps>}
);

/** Display label for a form id, falling back to the id. */
export const formLabel = (uiSpec: PlanConfigUiSpec, formType: string) =>
  uiSpec.viewsets[formType]?.label || formType;

/** Display label for a field id, falling back to the id. */
export const fieldLabel = (uiSpec: PlanConfigUiSpec, fieldName: string) => {
  const label = uiSpec.fields[fieldName]?.['component-parameters']?.label;
  return typeof label === 'string' && label ? label : fieldName;
};
