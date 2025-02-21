import {createContext, ReactNode, useEffect, useState} from 'react';
import {
  activateProjectDB,
  getProjectsDB,
  setSyncProjectDB,
  updateProjectsDB,
} from '../dbs/projects-db';
import {activate_project, syncProjectDb} from '../sync/process-initialization';
import {ProjectObject, refreshMetadataDb} from '../sync/projects';
import {getListing} from '../sync/state';
import {ProjectExtended} from '../types/project';
import {getLocalActiveMap, getProjectMap, getRemoteProjects} from './functions';
import {refreshActiveUser} from './slices/authSlice';
import {store} from './store';

export const ProjectsContext = createContext<{
  projects: ProjectExtended[];
  activateProject: (id: string, listing: string) => void;
  setProjectSync: (id: string, listing: string, sync: boolean) => void;
  syncProjects: () => Promise<void>;
  initProjects: () => Promise<void>;
}>({
  projects: [],
  activateProject: () => {},
  setProjectSync: () => {},
  syncProjects: () => new Promise(() => {}),
  initProjects: () => new Promise(() => {}),
});

/**
 * Provides a context for managing projects.
 *
 * @param children - The child components to be wrapped by the provider.
 */
export function ProjectsProvider({children}: {children: ReactNode}) {
  const [projects, setProjects] = useState<ProjectExtended[]>([]);

  useEffect(() => {
    initProjects();
  }, []);

  /**
   * Initializes the application by synchronizing local and remote projects.
   * First, it fetches projects from the local database and sets them in the
   * project state, then it synchronizes with remote projects to update the
   * local state and database as needed.
   *
   * This can be, and is also used to update existing records from API - it is
   * idempotent.
   *
   * @returns Resolves when initialization is complete.
   */
  const initProjects = async () => {
    // Get the local projects (i.e. those in the local project database)
    const localProjects = await getProjectsDB();

    // Get the remote projects (i.e. those in the remote database/server)
    const {projects: remoteProjects, listingToSuccessful} =
      await getRemoteProjects();

    // Get a map [projectId -> project]
    const localProjectsMap = getProjectMap(localProjects);

    // Copy for modification
    const newProjectsMap = getProjectMap(localProjects);

    // Get a map for the existing local projects
    const localActiveMap = await getLocalActiveMap();

    // For each remote fetched project, synchronise details
    for (const remoteProject of remoteProjects) {
      const activated =
        localProjectsMap.get(remoteProject._id)?.activated ??
        localActiveMap.has(remoteProject._id) ??
        false;

      const sync =
        localProjectsMap.get(remoteProject._id)?.sync ??
        localActiveMap.get(remoteProject._id)?.sync ??
        false;

      newProjectsMap.set(remoteProject._id, {
        ...remoteProject,
        activated,
        sync,
      });
    }

    // Now consider listing fetches which were successful which reveal now
    // missing databases - these have been deleted!

    // TODO we need a more considered hook for deletion here which properly cleans up the DBs
    const toRemoveProjects: ProjectExtended[] = [];
    for (const [listingId, successful] of listingToSuccessful.entries()) {
      if (successful) {
        // Get just the entries for this listing from remote (as a set)
        const remoteSet = new Set(
          remoteProjects
            .filter(project => project.listing === listingId)
            .map(project => project._id)
        );

        // Get the current set of projects for this listing
        const currentSet = new Set(
          newProjectsMap
            .values()
            .filter(project => project.listing === listingId)
            .map(project => project._id)
        );

        // Find the difference in these sets - i.e. those that are in the current but no longer in the remote
        const toRemoveProjectIds = currentSet.difference(remoteSet);

        for (const projectId of toRemoveProjectIds) {
          // Project information (retain here so we can use for removal)
          toRemoveProjects.push(newProjectsMap.get(projectId)!);

          // These must be removed from the new project map

          // TODO define a protocol for this - given that we have multiple users
          // per listing - to safely delete we would need to know who activated
          // it - so that this is only relative to the person who fetched it
          // newProjectsMap.delete(projectId);
        }
      }
    }

    // Build project list (proposed update) from this merge
    const newProjects = [...newProjectsMap.values()];
    updateProjectsDB(newProjects);
    setProjects(newProjects);

    // Now, update the parallel (silly!!) project database :(

    // TODO this is ridiculous - just do this in a non insane way (i.e. a single
    // store which contains listings, projects, activated status, reference to
    // the DBs etc)
    const listings = new Set(newProjects.map(p => p.listing));
    for (const l of listings) {
      const listingDetails = getListing(l);
      // Build project objects for this listing
      const projectObjects: ProjectObject[] = newProjects
        .filter(p => p.listing === l)
        .map(project => {
          return {
            _id: project._id,
            project_id: project.project_id,
            name: project.name,
            created: project.created,
            description: project.description,
            last_updated: project.last_updated,
            metadata_db: undefined,
            data_db: undefined,
            status: project.status,
            conductor_url: project.conductor_url,
          };
        });
      syncProjectDb({
        projects: projectObjects,
        listingId: l,
        conductorUrl: listingDetails.listing.conductor_url,
      });
    }

    // Refresh activated project metadata DB
    for (const project of newProjects) {
      if (project.activated) {
        // NOTE: This does not work offline
        // This refreshes the UI spec and metadata for the existing metadata DB
        await refreshMetadataDb({
          // this _id is the listing specific ID
          projectId: project._id,
          // this is the listing ID
          listingId: project.listing,
        });
      }
    }

    // TODO clean up the old projects in toRemoveProjects
    // TODO how should we deal with projects that are removed from
    // the remote directory - should we delete them here or offer another option
    // what if there are unsynced records?
  };

  /**
   * Synchronizes the list of projects with remote projects, updating the local project list
   * to include any remote project updates while preserving the activation state.
   *
   * @returns Resolves when the project synchronization is complete.
   */
  const syncProjects = async () => {
    // sync projects can just re-init projects - it's the same operation
    await initProjects();
    await store.dispatch(refreshActiveUser());
  };

  /**
   * Activates a project.
   *
   * @param id - The ID of the project to activate.
   * @param listing - The listing of the project to activate.
   */
  const activateProject = async (id: string, listing: string) => {
    try {
      await activate_project(listing, id);
    } catch (err) {
      console.error('Failed to activate project', err);
      return;
    }

    setProjects(projects =>
      projects.map(p =>
        p._id === id ? {...p, activated: true, sync: true} : p
      )
    );

    activateProjectDB(id);
  };

  /**
   * Sets the sync status of a project.
   *
   * @param id - The ID of the project to set the sync status of.
   * @param listing - The listing of the project to set the sync status of.
   * @param sync - The sync status to set.
   */
  const setProjectSync = async (id: string, listing: string, sync: boolean) => {
    try {
      await activate_project(listing, id, sync);
    } catch (err) {
      console.error('Failed to activate project', err);
      return;
    }

    setProjects(projects =>
      projects.map(p => (p._id === id ? {...p, sync} : p))
    );

    setSyncProjectDB(id, sync);
  };

  return (
    <ProjectsContext.Provider
      value={{
        projects,
        activateProject,
        setProjectSync,
        syncProjects,
        initProjects,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}
