import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import jsonpointer from 'jsonpointer';

const DEFAULT_INSTANCE_ID = 'default';
const PROJECT_DBNAME_PREFIX = 'project-';

interface ConnectionInfo {
    host: string,
    port: number,
    lan: boolean | undefined,
    db_name: string
}

interface DirectoryDoc {
    _id: string;
    name: string;
    description: string;
    people_db: null |  ConnectionInfo,
    projects_db: null |  ConnectionInfo,
    devices_db: null |  ConnectionInfo
}

interface DefaultInstanceDirectoryDoc extends DirectoryDoc {
    // All are not null:
    people_db: ConnectionInfo,
    projects_db: ConnectionInfo,
    devices_db: ConnectionInfo
}

interface ActiveDoc {
    instance_id: string
    project_id: string
    username: string
    password: string
}

interface LocalDBList {
    [key: string] : PouchDB.Database
}

interface ProjectInfo {
    name: string,
    description: string,
    connection: null | ConnectionInfo
    //TODO: Schema
}

/**
 * Directory: All (public, anyways) Faims instances 
 */
const directory_db = new PouchDB<DirectoryDoc>("directory");

let default_instance : null | DefaultInstanceDirectoryDoc = null; //Set to directory_db.get(DEFAULT_INSTANCE_ID) by get_default_instance

/**
 * Active: A local (NOT synced) list of:
 *   {_id, username, password, project_id, instance_id}
 *   For each project the current device is part of (so this is keyed by instance id + project id),
 *   * instance_id: A couchdb instance object's id (from "directory" db)
 *   * project_id: A project id (from the project_db in the couchdb instance object.)
 *   * username, password: A device login (mostly the same across all docs in this db, except for differences in devices_db of the instance),
 */
const active_db = new PouchDB<ActiveDoc>("active");

/**
 * mapping from instance id to a PouchDB CLIENTSIDE DB
 */
let projects_dbs : LocalDBList = {};
/**
 * mapping from instance id to a PouchDB Connection to a server database
 */
let remote_projects_dbs : LocalDBList = {};

/**
 * mapping from instance id to a PouchDB CLIENTSIDE DB
 */
let devices_dbs : LocalDBList = {};
/**
 * mapping from instance id to a PouchDB Connection to a server database
 */
let remote_devices_dbs : LocalDBList = {};

/**
 * mapping from active id (instance id/project id) to a PouchDB CLIENTSIDE DB
 */
let project_dbs : LocalDBList = {};
/**
 * mapping from active id (instance id/project id) to a PouchDB Connection to a server database
 */
let remote_project_dbs : LocalDBList = {};

/**
 * 
 * @param prefix Name to use to run new PouchDB(prefix + '/' + id)
 * @param instance_info An instance object, i.e. a doc from the directory db
 * @param instance_member_name 'projects_db' or 'devices_db'
 * @param global_client_dbs projects_db or devices_db
 * @param global_server_dbs remote_projects_db or remote_devices_db
 * @returns The local DB
 */
function ensure_instance_db_is_local_and_synced(
    prefix: string,
    local_db_id : string,
    connection_info : ConnectionInfo,
    global_client_dbs : LocalDBList,
    global_server_dbs : LocalDBList
) : PouchDB.Database {
    // Already connected/loaded local DB
    if(global_client_dbs[local_db_id]) {
        return global_client_dbs[local_db_id];
    }

    if(
        typeof(connection_info) !== 'object' ||
        typeof(connection_info.host) !== 'string' ||
        typeof(connection_info.port) !== 'string' ||
        typeof(connection_info.lan) !== 'boolean' ||
        typeof(connection_info.db_name) !== 'string'
    ) {
        throw({message:"One of the active FAIMS instances is misconfigured in the FAIMS directory.", error: "database_directory_format"});
    }

    // The first part of this function, to get the local DB
    // Creates the prefix/escaped_name using the local_db_id
    // then uses said name on a new PouchDB(name) to load the database.

    try {

        // Load any existing data from the client
        global_client_dbs[local_db_id] = new PouchDB(prefix + '/' + local_db_id);
    } catch(err) {
        if(global_client_dbs[local_db_id]) {
            delete global_client_dbs[local_db_id];
        }
    }

    // Second part here is optional, in that if an error occurs,
    // the client side database is still returned.
    // This is to ensure the database is runnable while offline

    try {
        global_server_dbs[local_db_id] = new PouchDB(
            connection_info.host + ':' + 
            connection_info.port + '/' +
            connection_info.db_name
        );
        // try to sync here, to ensure the connection works or returns false.
        PouchDB.replicate(global_server_dbs[local_db_id], global_client_dbs[local_db_id]);
    } catch(err) {
        console.error("Could not sync the remote instance DB " + JSON.stringify(connection_info) + ":");
        console.error(err);
        delete global_server_dbs[local_db_id]
    }
    return global_client_dbs[local_db_id]
}

async function get_default_instance() : Promise<DefaultInstanceDirectoryDoc> {
    if(default_instance == null) {
        let possibly_corrupted_instance=  await directory_db.get(DEFAULT_INSTANCE_ID);
        default_instance = {
            _id:        possibly_corrupted_instance._id,
            name:       possibly_corrupted_instance.name,
            description:possibly_corrupted_instance.description,
            people_db:  possibly_corrupted_instance.people_db!,
            projects_db:possibly_corrupted_instance.projects_db!,
            devices_db: possibly_corrupted_instance.devices_db!
        };
    }
    return default_instance;
}

PouchDB.plugin(PouchDBFind);

export async function initialize_directory(directory_url : string) {
    try {
        let directory_remote = new PouchDB(directory_url);
        PouchDB.replicate(directory_remote, directory_db);
    } catch(error) {
        console.error("Could not connect to directory server to sync: " + error);
    }

    // For every active project, try to sync their devices & projects DBs
    let active_projects = (await active_db.find({selector:{}})).docs;

    active_projects.forEach(async doc => {
        if(
            typeof(doc.instance_id) !== 'string' ||
            typeof(doc.project_id) !== 'string' ||
            typeof(doc.username) !== 'string' ||
            typeof(doc.password) !== 'string'
        ) {
            console.error({message:"The internal database is (partially) corrupted.", error: "database_active_format", doc:doc});
            directory_db.remove(doc);
            return; //This doesn't throw because we want to be tolerant of errors and let the user re-add the active project
        }
        
        // First, using the instance id, ensure that the projects and devices dbs are accessable
        
        let instance_info = await directory_db.get(doc.instance_id);

        let projects_local_id = instance_info['projects_db'] ? instance_info._id : DEFAULT_INSTANCE_ID;
        let projects_connection_info = instance_info['projects_db'] || (await get_default_instance())['projects_db'];

        let projects_db = ensure_instance_db_is_local_and_synced(
            'projects',
            projects_local_id,
            projects_connection_info,
            projects_dbs,
            remote_projects_dbs
        ) as PouchDB.Database<ProjectInfo>;

        let devices_local_id = instance_info['devices_db'] ? instance_info._id : DEFAULT_INSTANCE_ID;
        let devices_connection_info = instance_info['devices_db'] || (await get_default_instance())['devices_db'];

        ensure_instance_db_is_local_and_synced(
            'devices',
            devices_local_id,
            devices_connection_info,
            devices_dbs,
            remote_devices_dbs
        );

        // Now that we have instance connections,
        // So the project should be accessable

        let project_info = await projects_db.get(doc.project_id);
        let project_local_id = doc._id;
        // Defaults to the same couch as the projects db, but different database name:
        let project_connection_info = project_info['connection'] || {
            host : projects_connection_info.host,
            port : projects_connection_info.port,
            lan : projects_connection_info.lan,
            db_name : PROJECT_DBNAME_PREFIX + project_info.name
        };

        ensure_instance_db_is_local_and_synced(
            'project',
            project_local_id,
            project_connection_info,
            project_dbs,
            remote_project_dbs
        );
    });


}

export function get_instances() {

}