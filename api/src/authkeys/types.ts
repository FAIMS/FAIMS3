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
 * Filename: src/authkeys/types.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */

import type {KeyLike} from 'jose';

export interface SigningKey {
  alg: string; // JWS alg
  kid: string; // JWS kid
  private_key: KeyLike;
  public_key: KeyLike;
  public_key_string: string;
  instance_name: string;
}
export interface KeyConfig {
  signing_algorithm: string;
  instance_name: string;
  key_id: string;
  public_key_file: string;
  private_key_file: string;
}
