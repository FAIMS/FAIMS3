import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import jsonpointer from 'jsonpointer';
import * as DataModel from '../datamodel';

const DEFAULT_LISTING_ID = 'default';
const PROJECT_DBNAME_PREFIX = 'project-';

interface LocalDBList<Content extends {}> {
    [key: string] : PouchDB.Database<Content>
}

/**
 * Directory: All (public, anyways) Faims instances 
 */
const directory_db = new PouchDB<DataModel.ListingsObject>("directory");

let default_instance : null | DataModel.NonNullListingsObject = null; //Set to directory_db.get(DEFAULT_LISTING_ID) by get_default_instance

/**
 * Active: A local (NOT synced) list of:
 *   {_id, username, password, project_id, listing_id}
 *   For each project the current device is part of (so this is keyed by listing id + project id),
 *   * listing_id: A couchdb instance object's id (from "directory" db)
 *   * project_id: A project id (from the project_db in the couchdb instance object.)
 *   * username, password: A device login (mostly the same across all docs in this db, except for differences in devices_db of the instance),
 */
const active_db = new PouchDB<DataModel.ActiveDoc>("active");

/**
 * mapping from listing id to a PouchDB CLIENTSIDE DB
 */
let projects_dbs : LocalDBList<DataModel.ProjectObject> = {};
/**
 * mapping from listing id to a PouchDB Connection to a server database
 */
let remote_projects_dbs : LocalDBList<DataModel.ProjectObject> = {};

/**
 * mapping from listing id to a PouchDB CLIENTSIDE DB
 */
let devices_dbs : LocalDBList<DataModel.DevicesDoc> = {};
/**
 * mapping from listing id to a PouchDB Connection to a server database
 */
let remote_devices_dbs : LocalDBList<DataModel.DevicesDoc> = {};

/**
 * mapping from active id (listing id/project id) to a PouchDB CLIENTSIDE DB
 */
let project_dbs : LocalDBList<DataModel.ProjectDoc> = {};
/**
 * mapping from active id (listing id/project id) to a PouchDB Connection to a server database
 */
let remote_project_dbs : LocalDBList<DataModel.ProjectDoc> = {};

/**
 * Creates a local PouchDB.Database used to access a remote Couch/Pouch instance
 * @param connection_info Network address/database info to use to initialize the connection
 * @returns A new PouchDB.Database, interfacing to the remote Couch/Pouch instance
 */
function ConnectionInfo_create_pouch<Content extends {}>(
    connection_info: DataModel.ConnectionInfo
) : PouchDB.Database<Content>
{
    return new PouchDB(
        connection_info.host + ':' + 
        connection_info.port + '/' +
        connection_info.db_name
    );
}

/**
 * 
 * @param prefix Name to use to run new PouchDB(prefix + '/' + id)
 * @param instance_info An instance object, i.e. a doc from the directory db
 * @param instance_member_name 'projects_db' or 'devices_db'
 * @param global_client_dbs projects_db or devices_db
 * @param global_server_dbs remote_projects_db or remote_devices_db
 * @returns The local DB
 */
function ensure_instance_db_is_local_and_synced<Content extends {}>(
    prefix: string,
    local_db_id : string,
    connection_info : DataModel.ConnectionInfo,
    global_client_dbs : LocalDBList<Content>,
    global_server_dbs : LocalDBList<Content>
) : PouchDB.Database<Content> {
    // Already connected/loaded local DB
    if(global_client_dbs[local_db_id]) {
        return global_client_dbs[local_db_id] as PouchDB.Database<Content>;
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
        global_server_dbs[local_db_id] = ConnectionInfo_create_pouch(connection_info);
        // try to sync here, to ensure the connection works or returns false.
        PouchDB.replicate(global_server_dbs[local_db_id], global_client_dbs[local_db_id]);
    } catch(err) {
        console.error(`Could not sync the remote instance DB ${JSON.stringify(connection_info)}:`);
        console.error(err);
        delete global_server_dbs[local_db_id]
    }
    return global_client_dbs[local_db_id]
}

async function get_default_instance() : Promise<DataModel.NonNullListingsObject> {
    if(default_instance == null) {
        let possibly_corrupted_instance=  await directory_db.get(DEFAULT_LISTING_ID);
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

/**
 * Creates & Populates the active_projects database,
 * then disconnects it
 * 
 * Call before initialize_db
 */
export async function populate_test_data() {
    let test_doc = {
        _id: 'default/lake_mungo',
        listing_id: 'default',
        project_id: 'lake_mungo',
        username: 'test1',
        password: 'apple'
    };
    let {id, rev, ok} = await active_db.put(test_doc);
    if(test_doc._id != id) throw("Could not correctly put the right test ID'd data");
    if(ok !== true) throw("Could not insert test data");
}

export async function initialize_dbs(directory_connection : DataModel.ConnectionInfo) {
    try {
        let directory_remote = ConnectionInfo_create_pouch(directory_connection);
        PouchDB.replicate(directory_remote, directory_db);
    } catch(error) {
        console.error(`Could not connect to directory server to sync: ${error}`);
    }

    // For every active project, try to sync their devices & projects DBs
    let active_projects = (await active_db.find({selector:{}})).docs;

    active_projects.forEach(async doc => {
        if(
            typeof(doc.listing_id) !== 'string' ||
            typeof(doc.project_id) !== 'string' ||
            typeof(doc.username) !== 'string' ||
            typeof(doc.password) !== 'string'
        ) {
            console.error({message:"The internal database is (partially) corrupted.", error: "database_active_format", doc:doc});
            directory_db.remove(doc);
            return; //This doesn't throw because we want to be tolerant of errors and let the user re-add the active project
        }
        
        // First, using the listing id, ensure that the projects and devices dbs are accessable
        
        let instance_info = await directory_db.get(doc.listing_id);

        let projects_local_id = instance_info['projects_db'] ? instance_info._id : DEFAULT_LISTING_ID;
        let projects_connection_info = instance_info['projects_db'] || (await get_default_instance())['projects_db'];

        let projects_db = ensure_instance_db_is_local_and_synced(
            'projects',
            projects_local_id,
            projects_connection_info,
            projects_dbs,
            remote_projects_dbs
        ) as PouchDB.Database<DataModel.ProjectObject>;

        let devices_local_id = instance_info['devices_db'] ? instance_info._id : DEFAULT_LISTING_ID;
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