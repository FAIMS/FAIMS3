/*
 * Copyright 2021, 2022 Macquarie University
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
 * Filename: version.ts
 * Description:
 *   A version string that can be changed via `npm run set-version' that
 * can override environment settings if present
 */

export const BUILD_VERSION_DEFAULT: string = 'not-set';
export const BUILD_VERSION: string = `${BUILD_VERSION_DEFAULT}`;
