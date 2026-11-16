// SPDX-License-Identifier: Apache-2.0

import {
  ConditionalExpressionSchema,
  type ConditionFn,
} from '@faims3/data-model';
import {z} from 'zod';

/**
 * A single selectable option in an options-based choice field (RadioGroup,
 * Select, MultiSelect). `RadioProps` carries the radio-button identity used by
 * the legacy radio-group rendering.
 *
 * `condition` is the same visibility AST used on fields and sections. Absence,
 * `undefined`, or `null` means the option is always listed.
 *
 * `conditionFn` is not part of stored notebook JSON: this schema strips it.
 * `compileUiSpecConditionals` attaches it in memory on compiled specs
 * ({@link ChoiceOption.conditionFn}) so `visibleChoiceOptions` can reuse it.
 */
export const ChoiceOptionSchema = z.object({
  // Stored option value used in answers, exports, and conditions.
  value: z.string(),
  // Human-readable label displayed to users. Supports Markdown.
  label: z.string(),
  key: z.string().optional(),
  RadioProps: z.object({id: z.string()}).passthrough().optional(),
  condition: ConditionalExpressionSchema.nullable().optional(),
});
export type ChoiceOption = z.infer<typeof ChoiceOptionSchema> & {
  /** Present only after `compileUiSpecConditionals`, when `condition` is set. */
  conditionFn?: ConditionFn;
};

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
