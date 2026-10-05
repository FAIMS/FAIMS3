// SPDX-License-Identifier: Apache-2.0
import {NOTEBOOK_LIST_DESCRIPTION_MAX_LENGTH} from '../buildconfig';
import type {Project} from '../context/slices/projectSlice';

/** Text for the notebook listing grid, or null when absent. */
export function formatNotebookListDescription(
  description: string | undefined
): string | null {
  const trimmed = description?.trim();
  if (!trimmed) return null;
  if (trimmed.length <= NOTEBOOK_LIST_DESCRIPTION_MAX_LENGTH) {
    return trimmed;
  }
  return `${trimmed.slice(0, NOTEBOOK_LIST_DESCRIPTION_MAX_LENGTH)}…`;
}

export function isNotebookListDescriptionTruncated(
  description: string | undefined
): boolean {
  const trimmed = description?.trim();
  return !!trimmed && trimmed.length > NOTEBOOK_LIST_DESCRIPTION_MAX_LENGTH;
}

export function sortProjectsByNewest(projects: Project[]): Project[] {
  return [...projects].sort((a, b) =>
    (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')
  );
}

/** True while this notebook is listed in the transient activating set. */
export function isProjectActivating(
  project: Pick<Project, 'serverId' | 'projectId'>,
  activatingProjectKeys: readonly string[]
): boolean {
  return activatingProjectKeys.includes(
    `${project.serverId}:${project.projectId}`
  );
}

/**
 * Split the workspace list so in-flight activations appear with Active
 * notebooks (disabled loading row) instead of staying in Not Active.
 */
export function partitionNotebookListProjects(
  projects: Project[],
  activatingProjectKeys: readonly string[]
): {activatedProjects: Project[]; availableProjects: Project[]} {
  return {
    activatedProjects: sortProjectsByNewest(
      projects.filter(
        project =>
          project.isActivated ||
          isProjectActivating(project, activatingProjectKeys)
      )
    ),
    availableProjects: sortProjectsByNewest(
      projects.filter(
        project =>
          !project.isActivated &&
          !isProjectActivating(project, activatingProjectKeys)
      )
    ),
  };
}
