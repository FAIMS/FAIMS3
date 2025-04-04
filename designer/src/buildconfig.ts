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
 *   managing template protections.
 */

const TRUTHY_STRINGS = ['true', '1', 'on', 'yes'];

/**
 * Checks if VITE_TEMPLATE_PROTECTIONS is enabled from environment variables.
 * Defaults to false if not set.
 *
 * @returns Boolean indicating if template protections are enabled
 */
function templateProtectionsEnabled(): boolean {
  const protectionEnabled = import.meta.env.VITE_TEMPLATE_PROTECTIONS;
  return protectionEnabled
    ? TRUTHY_STRINGS.includes(protectionEnabled.toLowerCase())
    : false;
}

export const VITE_TEMPLATE_PROTECTIONS = templateProtectionsEnabled();
