import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import jsonpointer from 'jsonpointer';
import * as DataModel from '../datamodel';

const DEFAULT_LISTING_ID = 'default';
const METADATA_DBNAME_PREFIX = 'data-';
const DATA_DBNAME_PREFIX = 'metadata-'

export interface LocalDB<Content extends {}> {
    local:             PouchDB.Database<Content>,
    remote:     null | PouchDB.Database<Content>,

    connection: null | PouchDB.Replication.Replication<Content> 
                     | PouchDB.Replication.Sync<Content>
}

export interface LocalDBList<Content extends {}> {
    [key: string] : LocalDB<Content>
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
 *   * username, password: A device login (mostly the same across all docs in this db, except for differences in people_db of the instance),
 */
const active_db = new PouchDB<DataModel.ActiveDoc>("active");

/**
 * Each listing has a Projects database and Users/People DBs
 */
let projects_dbs : LocalDBList<DataModel.ProjectObject> = {};

/**
 * mapping from listing id to a PouchDB CLIENTSIDE DB
 */
let people_dbs : LocalDBList<DataModel.PeopleDoc> = {};

/**
 * Per-[active]-project project data:
 * Contain in these databases (indexed by the active_db id's)
 * is project data.
 */
let data_dbs : LocalDBList<DataModel.ProjectDoc> = {};

/**
 * Synced from the project metadatabase for each active project,
 * This has the metadata describing a database. Project Schemas,
 * GUI Models, and a Prople database.
 */
let metadata_dbs : LocalDBList<DataModel.ProjectMetaObject> = {};

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
        connection_info.proto + '://' +
        connection_info.host + ':' + 
        connection_info.port + '/' +
        connection_info.db_name
    );
}

/**
 * 
 * @param prefix Name to use to run new PouchDB(prefix + '/' + id)
 * @param instance_info An instance object, i.e. a doc from the directory db
 * @param instance_member_name 'projects_db' or 'people_db'
 * @param global_client_dbs projects_db or people_db
 * @param global_server_dbs remote_projects_db or remote_people_db
 * @returns The local DB
 */
function ensure_instance_db_is_local_and_synced<Content extends {}>(
    prefix: string,
    local_db_id : string,
    connection_info : DataModel.ConnectionInfo,
    global_dbs : LocalDBList<Content>,
) : LocalDB<Content> {
    // Already connected/loaded local DB
    if(global_dbs[local_db_id]) {
        return global_dbs[local_db_id];
    }

    // The first part of this function, to get the local DB
    // Creates the prefix/escaped_name using the local_db_id
    // then uses said name on a new PouchDB(name) to load the database.

    // Load any existing data from the client
    let local : PouchDB.Database<Content> = new PouchDB(prefix + '/' + local_db_id);

    let remote : PouchDB.Database<Content>;
    let connection : PouchDB.Replication.Replication<Content>;

    // Second part here is optional, in that if an error occurs,
    // the client side database is still returned.
    // This is to ensure the database is runnable while offline

    try {
        remote = ConnectionInfo_create_pouch(connection_info);
        // try to sync here, to ensure the connection works or returns false.
        connection = PouchDB.replicate(local, remote);

        return global_dbs[local_db_id] = {
            local:local, 
            remote: remote, 
            connection: connection
        };
    } catch(err) {
        console.error(`Could not sync the remote instance DB ${JSON.stringify(connection_info)}:`);
        console.error(err);
        
        return global_dbs[local_db_id] = {local:local, remote: null, connection: null};
    }
}

async function get_default_instance() : Promise<DataModel.NonNullListingsObject> {
    if(default_instance == null) {
        let possibly_corrupted_instance=  await directory_db.get(DEFAULT_LISTING_ID);
        default_instance = {
            _id:        possibly_corrupted_instance._id,
            name:       possibly_corrupted_instance.name,
            description:possibly_corrupted_instance.description,
            projects_db:possibly_corrupted_instance.projects_db!,
            people_db: possibly_corrupted_instance.people_db!
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

    // For every active project, try to sync their people & projects DBs
    let active_projects = (await active_db.find({selector:{}})).docs;

    let syncer_tasks : Array<Promise<void>> = [];

    active_projects.forEach(doc => {
        let syncer_task_func = async (doc : PouchDB.Core.ExistingDocument<DataModel.ActiveDoc>) => {
            try {
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
                
                // First, using the listing id, ensure that the projects and people dbs are accessable
                
                let listing_object = await directory_db.get(doc.listing_id);

                let projects_local_id = listing_object['projects_db'] ? listing_object._id : DEFAULT_LISTING_ID;
                let projects_connection = listing_object['projects_db'] || (await get_default_instance())['projects_db'];

                let projects_db = ensure_instance_db_is_local_and_synced(
                    'projects',
                    projects_local_id,
                    projects_connection,
                    projects_dbs,
                ).local as PouchDB.Database<DataModel.ProjectObject>;

                let people_local_id = listing_object['people_db'] ? listing_object._id : DEFAULT_LISTING_ID;
                let people_connection = listing_object['people_db'] || (await get_default_instance())['people_db'];

                ensure_instance_db_is_local_and_synced(
                    'people',
                    people_local_id,
                    people_connection,
                    people_dbs
                );

                // Now that we have instance connections,
                // So the project should be accessable

                let project_info : DataModel.ProjectObject = await projects_db.get(doc.project_id);
                let project_local_id = doc._id;
                // Defaults to the same couch as the projects db, but different database name:
                let meta_connection_info = project_info.metadata_db || {
                    proto: projects_connection.proto,
                    host : projects_connection.host,
                    port : projects_connection.port,
                    lan : projects_connection.lan,
                    db_name : METADATA_DBNAME_PREFIX + project_info.name
                };

                ensure_instance_db_is_local_and_synced(
                    'metadata',
                    project_local_id,
                    meta_connection_info,
                    metadata_dbs
                );

                // Defaults to the same couch as the projects db, but different database name:
                let data_connection_info = project_info.data_db || {
                    proto: projects_connection.proto,
                    host : projects_connection.host,
                    port : projects_connection.port,
                    lan : projects_connection.lan,
                    db_name : DATA_DBNAME_PREFIX + project_info.name
                };

                ensure_instance_db_is_local_and_synced(
                    'data',
                    project_local_id,
                    data_connection_info,
                    data_dbs
                );
            } catch(err) {
                console.error('Failed to initialize an active database ', doc, err);
            }
        };
        syncer_tasks.push(syncer_task_func(doc));
    });


}

export function get_instances() {

}