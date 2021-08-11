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
 * Filename: core.ts
 * Description:
 *   TODO
 */

// There are two internal IDs for projects, the former is unique to the system
// (i.e. includes the listing_id), the latter is unique only to the 'projects'
// database it came from, for a FAIMS listing
// (It is this way because the list of projects is decentralised and so we
// cannot enforce system-wide unique project IDs without a 'namespace' listing id)
export type ProjectID = string;
export type NonUniqueProjectID = string;

export function resolve_project_id(
  listing_id: string,
  nonunique_id: NonUniqueProjectID
): ProjectID {
  const cleaned_listing_id = listing_id.replace('||', '\\|\\|');
  return cleaned_listing_id + '||' + nonunique_id;
}

// There are two internal ID for observations, the former is unique to a
// project, the latter unique to the system (i.e. includes project_id)
export type ObservationID = string;
export type FullyResolvedObservationID = string;
export interface SplitObservationID {
  project_id: string;
  observation_id: ObservationID;
}

export function resolve_observation_id(
  split_id: SplitObservationID
): FullyResolvedObservationID {
  const cleaned_project_id = split_id.project_id.replace('||', '\\|\\|');
  return cleaned_project_id + '||' + split_id.observation_id;
}

export function split_full_observation_id(
  full_proj_id: FullyResolvedObservationID
): SplitObservationID {
  const splitid = full_proj_id.split('||');
  if (
    splitid.length !== 2 ||
    splitid[0].trim() === '' ||
    splitid[1].trim() === ''
  ) {
    throw Error('Not a valid full observation id');
  }
  const cleaned_project_id = splitid[0].replace('\\|\\|', '||');
  return {
    project_id: cleaned_project_id,
    observation_id: splitid[1],
  };
}

export type RevisionID = string;
export type AttributeValuePairID = string;
