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
 * Filename: src/datamodel/users.ts
 * Description:
 *   Data models related to users.
 */
import {z} from 'zod';
import {Role} from '../../permission/model';
import {resourceRoleSchema} from '../../permission/types';
import {CouchDocumentSchema, CouchExistingDocumentSchema} from '../utils';

// Basic types defined as Zod schemas
export const ServiceIDSchema = z.string();
export type ServiceID = z.infer<typeof ServiceIDSchema>;

export const UserServiceProfileLockedSchema = z.unknown();
export type UserServiceProfileLocked = z.infer<
  typeof UserServiceProfileLockedSchema
>;

export const UserServiceProfilesSchema = z.record(
  UserServiceProfileLockedSchema
);
export type UserServiceProfiles = z.infer<typeof UserServiceProfilesSchema>;

export const CouchDBUsernameSchema = z.string();
export type CouchDBUsername = z.infer<typeof CouchDBUsernameSchema>;

export const CouchDBUserRoleSchema = z.string();
export type CouchDBUserRole = z.infer<typeof CouchDBUserRoleSchema>;

export const CouchDBUserRolesSchema = z.array(CouchDBUserRoleSchema);
export type CouchDBUserRoles = z.infer<typeof CouchDBUserRolesSchema>;

export const EmailSchema = z.string().email();
export type Email = z.infer<typeof EmailSchema>;

export const ConductorRoleSchema = z.string();
export type ConductorRole = z.infer<typeof ConductorRoleSchema>;

export const AllProjectRolesSchema = z.record(z.array(ConductorRoleSchema));
export type AllProjectRoles = z.infer<typeof AllProjectRolesSchema>;

export const OtherRolesSchema = z.array(ConductorRoleSchema);
export type OtherRoles = z.infer<typeof OtherRolesSchema>;

// V1 Schema
export const PeopleV1FieldsSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  emails: z.array(EmailSchema),
  roles: z.array(z.string()),
  project_roles: AllProjectRolesSchema,
  other_roles: OtherRolesSchema,
  profiles: UserServiceProfilesSchema,
  owned: z.array(z.string()),
});
export type PeopleV1Fields = z.infer<typeof PeopleV1FieldsSchema>;
export type PeopleV1Document = PouchDB.Core.ExistingDocument<PeopleV1Fields>;

// Resource Role Map schema
export const ResourceRoleMapSchema = z.record(
  z
    .array(
      z.object({
        resourceId: z.string(),
        role: z.nativeEnum(Role),
      })
    )
    .optional()
);
export type ResourceRoleMap = z.infer<typeof ResourceRoleMapSchema>;

// V2 Schema
export const PeopleV2FieldsSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  emails: z.array(EmailSchema),
  globalRoles: z.array(z.nativeEnum(Role)),
  resourceRoles: z.array(resourceRoleSchema),
  profiles: UserServiceProfilesSchema,
});
export type PeopleV2Fields = z.infer<typeof PeopleV2FieldsSchema>;
export type PeopleV2Document = PouchDB.Core.ExistingDocument<PeopleV2Fields>;

// V3 Schema (current)
export const PeopleV3FieldsSchema = z.object({
  user_id: z.string(),
  name: z.string(),
  emails: z.array(EmailSchema),
  profiles: UserServiceProfilesSchema,
  projectRoles: z.array(resourceRoleSchema),
  teamRoles: z.array(resourceRoleSchema),
  templateRoles: z.array(resourceRoleSchema),
  globalRoles: z.array(z.nativeEnum(Role)),
});
export type PeopleV3Fields = z.infer<typeof PeopleV3FieldsSchema>;
export type PeopleV3Document = PouchDB.Core.ExistingDocument<PeopleV3Fields>;

// V4 Schema (current)
export const VerifiableEmailSchema = z.object({
  // What is the email address?
  email: EmailSchema,
  // Records whether this email is verified or not
  verified: z.boolean(),
});
export const PeopleV4FieldsSchema = z.object({
  // All the same
  user_id: z.string(),
  name: z.string(),
  profiles: UserServiceProfilesSchema,
  projectRoles: z.array(resourceRoleSchema),
  teamRoles: z.array(resourceRoleSchema),
  templateRoles: z.array(resourceRoleSchema),
  globalRoles: z.array(z.nativeEnum(Role)),

  // Email updates to include verification
  emails: z.array(VerifiableEmailSchema),
});
export type VerifiableEmail = z.infer<typeof VerifiableEmailSchema>;
export type PeopleV4Fields = z.infer<typeof PeopleV4FieldsSchema>;
export type PeopleV4Document = PouchDB.Core.ExistingDocument<PeopleV4Fields>;

// Current Version (V3)
export const PeopleDBFieldsSchema = PeopleV4FieldsSchema;
export type PeopleDBFields = z.infer<typeof PeopleDBFieldsSchema>;

// Document
export const PeopleDBDocumentSchema = CouchDocumentSchema.extend(
  PeopleDBFieldsSchema.shape
);
export type PeopleDBDocument = z.infer<typeof PeopleDBDocumentSchema>;

// Existing document
export const ExistingPeopleDBDocumentSchema =
  CouchExistingDocumentSchema.extend(PeopleDBFieldsSchema.shape);
export type ExistingPeopleDBDocument = z.infer<
  typeof ExistingPeopleDBDocumentSchema
>;

// Database
export type PeopleDB = PouchDB.Database<PeopleDBFields>;
