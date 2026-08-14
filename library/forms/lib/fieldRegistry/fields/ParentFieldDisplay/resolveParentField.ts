/*
 * Copyright 2026 Macquarie University
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
 * Filename: resolveParentField.ts
 * Description:
 *   Re-export; the implementation lives in @faims3/data-model
 *   (derivedFields) so the API's refresh pass (#2245) shares it.
 */

export {
  formatFieldValue,
  resolveParentFieldValue,
  type ParentFieldResolution,
} from '@faims3/data-model';
