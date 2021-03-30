import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import jsonpointer from 'jsonpointer';

const DEFAULT_INSTANCE_ID = 'default';

/**
 * Directory: All (public, anyways) Faims instances 
 */
const directory_db = new PouchDB("directory");
/**
 * Active: A local (NOT synced) list of:
 *   {_id, username, password, project_id, instance_id}
 *   For each project the current device is part of (so this is keyed by instance id + project id),
 *   * instance_id: A couchdb instance object's id (from "directory" db)
 *   * project_id: A project id (from the project_db in the couchdb instance object.)
 *   * username, password: A device login (mostly the same across all docs in this db, except for differences in devices_db of the instance),
 */
const active_db = new PouchDB("active");

/**
 * mapping from instance id to a PouchDB CLIENTSIDE DB
 */
let projects_dbs = {};
/**
 * mapping from instance id to a PouchDB Connection to a server database
 */
let remote_projects_dbs = {};

/**
 * mapping from instance id to a PouchDB CLIENTSIDE DB
 */
let devices_dbs = {};
/**
 * mapping from instance id to a PouchDB Connection to a server database
 */
let remote_devices_dbs = {};

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
    prefix,
    local_db_id,
    connnection_info,
    global_client_dbs,
    global_server_dbs
) {

    // Already connected/loaded local DB
    if(global_client_dbs[local_db_id]) return global_client_dbs[local_db_id];

    if(
        typeof(connection_info) !== 'object' ||
        typeof(connection_info.host) !== 'string' ||
        typeof(connection_info.port) !== 'string' ||
        typeof(connection_info.lan) !== 'boolean' ||
        typeof(connection_info.db_name) !== 'string'
    ) {
        throw({message:"One of the active FAIMS instances is misconfigured in the FAIMS directory.", error: "database_directory_format"});
    }

    // Load any existing data from the client
    global_client_dbs[local_db_id] = new PouchDB(prefix + '/' + local_db_id);
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
        global_server_dbs[local_db_id] = null;
    }
    return global_client_dbs[local_db_id]
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

    active_projects.forEach(doc => {
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
        
        let instance_info = directory_db.get({_id: doc.instance_id});

        let projects_local_id = instance_info['projects_db'] ? instance_info._id : DEFAULT_INSTANCE_ID;
        let projects_connection_info = instance_info['projects_db'] || directory_db.get({_id: DEFAULT_INSTANCE_ID});

        let projects_db = ensure_instance_db_is_local_and_synced(
            'projects',
            projects_local_id,
            projects_connection_info,
            projects_dbs,
            remote_projects_dbs
        );

        let devices_local_id = instance_info['devices_db'] ? instance_info._id : DEFAULT_INSTANCE_ID;
        let devices_connection_info = instance_info['devices_db'] || directory_db.get({_id: DEFAULT_INSTANCE_ID});

        let devices_db = ensure_instance_db_is_local_and_synced(
            'devices',
            devices_local_id,
            devices_connection_info,
            devices_dbs,
            remote_devices_dbs
        );

        let project_info = projects_db.get({_id: doc.project_id});
        let project_local_id = 
        let project_connection_info = project_info['connection'] || projects_connection_info;

        let project_db = ensure_instance_db_is_local_and_synced
            'project',
            doc._id,
            project_info.connection

    });


}

export function get_instances() {

}