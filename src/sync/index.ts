import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import jsonpointer from 'jsonpointer';
import * as DataModel from '../datamodel';

const DEFAULT_LISTING_ID = 'default';
const METADATA_DBNAME_PREFIX = 'metadata-';
const DATA_DBNAME_PREFIX = 'data-'

export interface LocalDB<Content extends {}> {
    local:      PouchDB.Database<Content>,
    remote:     PouchDB.Database<Content>,

    is_sync : boolean,
    connection: PouchDB.Replication.Replication<Content> 
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

    let remote : PouchDB.Database<Content> = ConnectionInfo_create_pouch(connection_info);
    
    let connection : PouchDB.Replication.Replication<Content> = PouchDB.replicate(local, remote, {
        live: true, retry: true
    });

    return global_dbs[local_db_id] = {
        local:local, 
        remote: remote, 
        is_sync: false,
        connection: connection
    };
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
 * Creates & Populates the active_projects database.
 * 
 * Call before initialize_db
 */
export async function populate_test_data() {
    let test_doc : any = {
        _id: 'default/lake_mungo',
        listing_id: 'default',
        project_id: 'lake_mungo',
        username: 'test1',
        password: 'apple'
    };
    
    try {
        let current_test_doc = await active_db.get('default/lake_mungo');
        test_doc._rev = current_test_doc._rev;
    } catch(err) {
        
    }
    let {id, rev, ok} = await active_db.put(test_doc);
    if(test_doc._id != id) throw("Could not correctly put the right test ID'd data");
    if(ok !== true) throw("Could not insert test data");
}

let listings_syncers : {[key:string]:Promise<void>} = {}

export async function initialize_dbs(directory_connection : DataModel.ConnectionInfo) {
    try {
        let directory_remote = ConnectionInfo_create_pouch<DataModel.ListingsObject>(directory_connection);
        
        /* ASYNC UNAWAITED */ PouchDB.replicate(directory_remote, directory_db, {
            live: false,
            retry: false
        }).on('paused', info => {
            directory_db.allDocs({
                include_docs: true
            }).then(all_listings => 
                all_listings.rows.forEach(listing => {
                    if(!listing.id.startsWith('_design/')) {
                        listings_syncers[listing.id] = /* ASYNC UNAWAITED */
                            activate_projects_for_listing(listing.doc!)
                            .catch(console.error)
                    }
                })
            );
        })
        
    } catch(error) {
        // console.error(`Could not connect to directory server to sync: ${error}`);
        throw error;
    }
}

async function activate_projects_for_listing(listing_object : PouchDB.Core.ExistingDocument<DataModel.ListingsObject>) {

    // Connect to people db and projects db for this listing db

    let projects_local_id = listing_object['projects_db'] ? listing_object._id : DEFAULT_LISTING_ID;
    let projects_connection = listing_object['projects_db'] || (await get_default_instance())['projects_db'];

    let people_local_id = listing_object['people_db'] ? listing_object._id : DEFAULT_LISTING_ID;
    let people_connection = listing_object['people_db'] || (await get_default_instance())['people_db'];

    // Only sync active projects:
    let active_projects = (await active_db.find({selector:{listing_id: listing_object._id}})).docs;

    // TODO: Pass in a filter to ensure_instance_db_is_local_and_synced
    // to filter to only active projects
    // (However, make sure that when the user adds another active project
    // that this people_db is re-activatable).
    ensure_instance_db_is_local_and_synced(
        'people',
        people_local_id,
        people_connection,
        people_dbs
    );

    let projects_db = ensure_instance_db_is_local_and_synced(
        'projects',
        projects_local_id,
        projects_connection,
        projects_dbs,
    );


    projects_db.connection.on('paused', () => {
        active_projects.forEach(doc => /* ASYNC UNAWAITED */activate_individual_project(doc).catch(console.error));
    });

    let activate_individual_project = async function
    (
        doc : PouchDB.Core.ExistingDocument<DataModel.ActiveDoc>
    ) {
        // Now that we have instance connections,
        // So the project should be accessable
        
        let project_info : DataModel.ProjectObject = await projects_db.local.get(doc.project_id);
        console.info(`Connecting to ${doc.project_id} Data/MetaData DBs...`);

        let project_local_id = doc._id;
        // Defaults to the same couch as the projects db, but different database name:
        let meta_connection_info = project_info.metadata_db || {
            proto: projects_connection.proto,
            host : projects_connection.host,
            port : projects_connection.port,
            lan : projects_connection.lan,
            db_name : METADATA_DBNAME_PREFIX + project_info._id
        };

        let data_connection_info = project_info.data_db || {
            proto: projects_connection.proto,
            host : projects_connection.host,
            port : projects_connection.port,
            lan : projects_connection.lan,
            db_name : DATA_DBNAME_PREFIX + project_info._id
        };

        ensure_instance_db_is_local_and_synced(
            'metadata',
            project_local_id,
            meta_connection_info,
            metadata_dbs
        );

        ensure_instance_db_is_local_and_synced(
            'data',
            project_local_id,
            data_connection_info,
            data_dbs
        );
    };
}

export function get_instances() {

}