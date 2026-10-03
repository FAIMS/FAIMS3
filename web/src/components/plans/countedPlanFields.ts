/**
 * @file Counted plan config as form fields: how many records of the plan's
 * form are required, and whether extra records may be added.
 */

import {z} from 'zod';
import type {Field} from '@/components/form';
import {formLabel, type PlanConfig, type PlanConfigContext} from './types';

const COUNT_MESSAGE = 'Enter a whole number greater than zero.';

export const countedPlanFields = ({
  template,
  uiSpec,
  prefix,
}: PlanConfigContext): Field[] => [
  {
    name: `${prefix}numberRequired`,
    label: `Number of ${formLabel(uiSpec, template.formType as string)} records required`,
    type: 'number',
    min: 1,
    step: 1,
    schema: z
      .number({error: COUNT_MESSAGE})
      .int(COUNT_MESSAGE)
      .positive(COUNT_MESSAGE),
    testId: 'plan-config-number-required',
  },
  {
    name: `${prefix}allowExtraRecords`,
    type: 'checkbox',
    checkboxLabel: 'Allow extra records beyond the number required',
    schema: z.boolean().optional(),
    testId: 'plan-config-allow-extra',
  },
];

export const countedPlanConfig = (
  values: Record<string, unknown>,
  prefix: string
): PlanConfig => ({
  numberRequired: values[`${prefix}numberRequired`],
  allowExtraRecords: values[`${prefix}allowExtraRecords`] === true,
});
