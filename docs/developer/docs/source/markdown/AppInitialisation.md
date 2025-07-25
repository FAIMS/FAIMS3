# App Database Handling

Documents how the app initialisers itself, setting up database connections etc.

Application state is stored in a redux store that is persisted in local storage.  This has
four 'slices' for different parts of the state:

- `auth` for authenticated user details
- `projects` for activated projects (notebooks or surveys)
- `alerts` for alerts to be shown to the user next time
- `records` for the state of the currently visible record

The [projects slice](../../../../../app/src/context/slices/projectSlice.ts) is the most
central here since it helps to manage the PouchDB databases underlying the app.

The project slice state consists mainly of a collection of servers.  Each server 
represents an instance of our API server which will have an associated CouchDB
instance.   The URLs of these are stored in the server record.   The record also
contains a collection of _projects_ which will hold the actual data once collected.

At any one time, the app may have a number of connections to servers in place but only
one will be presented to the user at a time.

A `Project` is a record of a project on a given server.  In the state record we store
the compiled uiSpec (schema) for the project, whether it is activated (available for use)
and the database connection if so.  The `DatabaseConnection` record contains references to
the local and remote Dbs (both PouchDB instances) and flags for whether we are
syncing documents and attachments.  This is our main entry point to the PouchDB databases.

The `addProject` action on the project slice creates a new project, at this point, no
databases are created.

The `activateProjectSync` action does the work of setting up databases for a project.
From the comments on that action, this involves:

- creating local pouch DB which stores the data synced from the remote
  (and new records)
- creating the remote pouch DB which is a connection point to the remote
  data-database
- creating the sync object which performs the synchronisation between the
  two databases
- registering the above non-serialisable objects into databaseService
- marking the project as activated and updating store state

`activateProject` is the exported function that is used to activate projects from
the app.  It runs the above action and then calls `couchInitialiser` on the local DB
which makes sure that design documents and security are up to date in the database.

`activateProject` is called from the ProjectCard component which presents the UI for
a project if the project has not already been activated.   It's also called from
the `ActivationSwitch` component when the user explicitly activates a project from the UI.
There is a corresponding `deactivateProject` action which removes the project from
the active list but does not delete any databases.

Note that when a local PouchDB instance is created, it will connect to an existing
database if present or create a new one if not.

The sync status of a project can be updated with the `stopSyncingProject` and
`resumeSyncingProject` actions.  These actions leave the database connections
alone but operate on the sync object (created with `createPouchDBSync`).

Lower level database connection management happens in [databaseService.ts](../../../../../app/src/context/slices/databaseService.ts)
via the singleton `DatabaseService` class.  This class maintains a register of
database connections to be re-used through the app.  It manages opening and closing
of databases and the sync settings to remote databases.

## App Initialisation

The function [initialize()](../../../../../app/src/sync/initialize.ts) defines the
startup procedure and is called on startup from the `InitialiseGate` component that wraps
the entire application.

As the first action in `initialize`, `rebuildDbs` is passed the current projects state.
For every active project, it will re-create the database connections, doing the same
work as activateProjects does when the project is first activated.

Following this, the uiSpec for each project is re-compiled.

The intialisation then calls `initialiseServers` which sends a request to each
configured server for its details.  It then calls `initialiseProjects` to
get up to date details of all projects - this will compile the uiSpec if it
is updated.
