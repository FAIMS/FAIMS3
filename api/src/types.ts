// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: src/types.ts
 * Description:
 *   This module contains the type overrides/definitions which the conductor
 *   uses in relation to third-party code.
 */

import {PeopleDBDocument, ResourceRole} from '@faims3/data-model';

export type AuthAction = 'register' | 'login';
export interface CustomSessionData {
  inviteId?: string;
  redirect?: string;
  action?: AuthAction;
}

export interface CustomRequest {
  flash(type: string, message?: any): any;
  flash(type: string): any[];
  flash(): {[key: string]: any[]};

  // Shape matches cookie-session's CookieSessionRequest so Express.Request can
  // extend both without a TS7 incompatible-property merge error. Custom fields
  // live on CookieSessionObject via the augmentation below.
  session?: CookieSessionInterfaces.CookieSessionObject | null;
}

declare global {
  namespace CookieSessionInterfaces {
    interface CookieSessionObject extends CustomSessionData {}
  }

  namespace Express {
    interface User extends PeopleDBDocument {
      // The drilled resource roles which pre-compute the teams membership etc
      resourceRoles: ResourceRole[];
      // Set when this session was created via impersonation; holds the user id
      // of the admin who initiated the impersonation (for auditing).
      impersonatingUserId?: string;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-interface
    interface Request extends CustomRequest {}
  }
}
