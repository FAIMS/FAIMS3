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
 *   `import.meta.env` using a two-pass zod pipeline (env -> strings, then
 *   strings -> typed values) and exposed via the `config` singleton.
 */

import {z} from 'zod';

const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'];

// Pass one: read and validate the raw environment into (optional) strings.
const EnvSchema = z.object({
  VITE_TEMPLATE_PROTECTIONS: z.string().optional(),
});

const rawEnv = EnvSchema.parse({
  VITE_TEMPLATE_PROTECTIONS: import.meta.env.VITE_TEMPLATE_PROTECTIONS,
});

// Pass two: build the typed configuration values. Defaults to false when unset.
const ConfigSchema = z.object({
  templateProtections: z
    .string()
    .optional()
    .transform(v => (v ? TRUTHY_STRINGS.includes(v.toLowerCase()) : false)),
});

/**
 * The singleton designer configuration object. Prefer reading values from here.
 */
export const config = ConfigSchema.parse({
  templateProtections: rawEnv.VITE_TEMPLATE_PROTECTIONS,
});

export type DesignerConfig = typeof config;
