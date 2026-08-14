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
 * Filename: addressTypes.ts
 * Description:
 *   Re-export; the schemas live in @faims3/data-model so server-side
 *   template evaluation (#2245) shares them.
 */

export {
  AddressSchema,
  AddressValueSchema,
  type AddressType,
  type AddressValue,
} from '@faims3/data-model';
