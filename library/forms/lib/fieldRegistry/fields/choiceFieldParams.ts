// SPDX-License-Identifier: Apache-2.0

import {z} from 'zod';

/**
 * A single selectable option in an options-based choice field (RadioGroup,
 * Select, MultiSelect). `RadioProps` carries the radio-button identity used by
 * the legacy radio-group rendering.
 */
export const ChoiceOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
  key: z.string().optional(),
  RadioProps: z.object({id: z.string()}).passthrough().optional(),
});
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema>;

/**
 * The `ElementProps` shape shared by the options-based choice fields. This is
 * the single definition consumed by each field's props schema and by the
 * designer's options editor; individual fields only ever use the subset of
 * these keys that applies to them (all extras are optional).
 */
export const ChoiceElementPropsSchema = z.object({
  options: z.array(ChoiceOptionSchema),
  expandedChecklist: z.boolean().optional(),
  exclusiveOptions: z.array(z.string()).optional(),
  enableOtherOption: z.boolean().optional(),
  otherOptionPosition: z.number().optional(),
});
export type ChoiceElementProps = z.infer<typeof ChoiceElementPropsSchema>;
