/*
 * Copyright 2021 Macquarie University
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
 * Filename: index.ts
 * Description:
 *   TODO
 */

import {EventEmitter} from 'events';
import {MetasCompleteType} from './state';
import {
  ListingsObject,
  ProjectObject,
  ProjectMetaObject,
  ProjectDataObject,
  ConnectionInfo,
} from '../datamodel';
import {ExistingActiveDoc, LocalDB} from './databases';

export class DebugEmitter extends EventEmitter {
  constructor(opts?: {captureRejections?: boolean}) {
    super(opts);
  }
  emit(event: string | symbol, ...args: unknown[]): boolean {
    console.debug(event, ...args);
    return super.emit(event, ...args);
  }
}

export const events: DirectoryEmitter = new DebugEmitter();

export interface DirectoryEmitter extends EventEmitter {
  on(
    event: 'project_meta_paused',
    listener: (
      listing: ListingsObject,
      active: ExistingActiveDoc,
      project: ProjectObject,
      meta: LocalDB<ProjectMetaObject>
    ) => unknown
  ): this;
  on(
    event: 'project_meta_active',
    listener: (
      listing: ListingsObject,
      active: ExistingActiveDoc,
      project: ProjectObject,
      meta: LocalDB<ProjectMetaObject>
    ) => unknown
  ): this;
  on(
    event: 'project_data_active',
    listener: (
      listing: ListingsObject,
      active: ExistingActiveDoc,
      project: ProjectObject,
      data: LocalDB<ProjectDataObject>
    ) => unknown
  ): this;
  on(
    event: 'project_data_paused',
    listener: (
      listing: ListingsObject,
      active: ExistingActiveDoc,
      project: ProjectObject,
      data: LocalDB<ProjectDataObject>
    ) => unknown
  ): this;
  on(
    event: 'project_local',
    listener: (
      listing: ListingsObject,
      active: ExistingActiveDoc,
      project: ProjectObject,
      meta: LocalDB<ProjectMetaObject>,
      data: LocalDB<ProjectDataObject>
    ) => unknown
  ): this;
  on(
    event: 'project_error',
    listener: (
      listing: ListingsObject,
      active: ExistingActiveDoc,
      err: unknown
    ) => unknown
  ): this;
  on(
    event: 'listing_local',
    listener: (
      listing: ListingsObject,
      projects: ExistingActiveDoc[],
      projects_db: LocalDB<ProjectObject>,
      default_connection: ConnectionInfo
    ) => unknown
  ): this;
  on(
    event: 'listing_paused',
    listener: (
      listing: ListingsObject,
      projects: ExistingActiveDoc[],
      projects_db: LocalDB<ProjectObject>,
      default_connection: ConnectionInfo
    ) => unknown
  ): this;
  on(
    event: 'listing_active',
    listener: (
      listing: ListingsObject,
      projects: ExistingActiveDoc[],
      projects_db: LocalDB<ProjectObject>,
      default_connection: ConnectionInfo
    ) => unknown
  ): this;
  on(
    event: 'listing_error',
    listener: (listing_id: string, err: unknown) => unknown
  ): this;
  on(
    event: 'directory_local',
    listener: (listings: Set<string>) => unknown
  ): this;
  on(
    event: 'directory_paused',
    listener: (listings: Set<string>) => unknown
  ): this;
  on(
    event: 'directory_active',
    listener: (listings: Set<string>) => unknown
  ): this;
  on(event: 'directory_error', listener: (err: unknown) => unknown): this;

  on(
    event: 'listings_known',
    listener: (listings: Set<string>) => unknown
  ): this;

  on(
    event: 'projects_known',
    listener: (projects: Set<string>) => unknown
  ): this;

  on(
    event: 'metas_complete',
    listener: (metas: MetasCompleteType) => unknown
  ): this;

  on(event: 'projects_created', listener: () => unknown): this;

  emit(
    event: 'project_meta_paused',
    listing: ListingsObject,
    active: ExistingActiveDoc,
    project: ProjectObject,
    meta: LocalDB<ProjectMetaObject>
  ): boolean;
  emit(
    event: 'project_meta_active',
    listing: ListingsObject,
    active: ExistingActiveDoc,
    project: ProjectObject,
    meta: LocalDB<ProjectMetaObject>
  ): boolean;
  emit(
    event: 'project_data_paused',
    listing: ListingsObject,
    active: ExistingActiveDoc,
    project: ProjectObject,
    data: LocalDB<ProjectDataObject>
  ): boolean;
  emit(
    event: 'project_data_active',
    listing: ListingsObject,
    active: ExistingActiveDoc,
    project: ProjectObject,
    data: LocalDB<ProjectDataObject>
  ): boolean;
  emit(
    event: 'project_local',
    listing: ListingsObject,
    active: ExistingActiveDoc,
    project: ProjectObject,
    meta: LocalDB<ProjectMetaObject>,
    data: LocalDB<ProjectDataObject>
  ): boolean;
  emit(
    event: 'project_error',
    listing: ListingsObject,
    active: ExistingActiveDoc,
    err: unknown
  ): boolean;
  emit(
    event: 'listing_local',
    listing: ListingsObject,
    projects: ExistingActiveDoc[],
    projects_db: LocalDB<ProjectObject>,
    default_connection: ConnectionInfo
  ): boolean;
  emit(
    event: 'listing_paused',
    listing: ListingsObject,
    projects: ExistingActiveDoc[],
    projects_db: LocalDB<ProjectObject>,
    default_connection: ConnectionInfo
  ): boolean;
  emit(
    event: 'listing_active',
    listing: ListingsObject,
    projects: ExistingActiveDoc[],
    projects_db: LocalDB<ProjectObject>,
    default_connection: ConnectionInfo
  ): boolean;
  emit(event: 'listing_error', listing_id: string, err: unknown): boolean;
  emit(event: 'directory_local', listings: Set<string>): boolean;
  emit(event: 'directory_paused', listings: Set<string>): boolean;
  emit(event: 'directory_active', listings: Set<string>): boolean;
  emit(event: 'directory_error', err: unknown): boolean;
  emit(event: 'listings_known', listings: Set<string>): boolean;
  emit(event: 'projects_known', projects: Set<string>): boolean;
  emit(event: 'metas_complete', metas: MetasCompleteType): boolean;
  emit(event: 'projects_created'): boolean;
}
