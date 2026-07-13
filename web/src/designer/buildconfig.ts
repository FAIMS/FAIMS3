/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: buildconfig.ts
 * Description:
 *   This module exports the configuration for the designer, specifically
 *   managing template protections. Configuration is parsed from Vite's
 *   `import.meta.env` with a single zod schema (coerce + rename) and exposed
 *   via the `config` singleton. Document env keys on the schema; the transform
 *   is rename-only.
 */

import {configHelpers} from '@faims3/data-model';
import {z} from 'zod';

const EnvSchema = z
  .object({
    /**
     * Enables template edit protections in the designer. Defaults to false
     * when unset.
     */
    VITE_TEMPLATE_PROTECTIONS: configHelpers.truthyBool(false),
  })
  .strip()
  .transform(({VITE_TEMPLATE_PROTECTIONS}) => ({
    /** Whether template protections are enabled. */
    templateProtections: VITE_TEMPLATE_PROTECTIONS,
  }));

/**
 * The singleton designer configuration object. Prefer reading values from here.
 *
 * Pass the whole `import.meta.env` — `.strip()` drops undeclared keys.
 */
export const config = EnvSchema.parse(import.meta.env);

export type DesignerConfig = typeof config;
