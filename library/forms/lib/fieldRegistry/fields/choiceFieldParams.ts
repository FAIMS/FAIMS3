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
