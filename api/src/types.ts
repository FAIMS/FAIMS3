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
 * Filename: src/types.ts
 * Description:
 *   This module contains the type overrides/definitions which the conductor
 *   uses in relation to third-party code.
 */
import {PeopleDBDocument, ResourceRole} from '@faims3/data-model';

export interface CustomSessionData {
  invite?: string;
  redirect?: string;
}

interface CustomRequest {
  flash(type: string, message?: any): any;
  flash(type: string): any[];
  flash(): {[key: string]: any[]};

  // Session can include the invite (possibly)
  session: CustomSessionData;
}

declare global {
  namespace Express {
    interface User extends PeopleDBDocument {
      // The drilled resource roles which pre-compute the teams membership etc
      resourceRoles: ResourceRole[];
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Request extends CustomRequest {}
  }
}
