const http = require('http');
const util = require('util');
const fs = require('fs');
const PouchDB = require('pouchdb');
const replicationStream = require('pouchdb-replication-stream');
const dbinfo = require('./dbinfo.js');

PouchDB.plugin(require('pouchdb-find'));
PouchDB.plugin(require('pouchdb-load'));
PouchDB.plugin(replicationStream.plugin);

/*
    From the CouchDB Documentation:
    Each CouchDB user is stored in document format. These documents contain several mandatory fields, that CouchDB needs for authentication:

    * _id             string:          Document ID. Contains user’s login with special prefix (https://docs.couchdb.org/en/stable/intro/security.html#org-couchdb-user)
    * derived_key     string:          PBKDF2 key
    * name            string:          User’s name aka login. Immutable e.g. you cannot rename an existing user - you have to create new one
    * roles           array of string: List of user roles. CouchDB doesn’t provide any built-in roles, so you’re free to define your own depending on your needs. However, you cannot set system roles like _admin there. Also, only administrators may assign roles to users - by default all users have no roles
    * password_sha    string:          Hashed password with salt. Used for simple password_scheme
    * password_scheme string:          Password hashing scheme. May be simple or pbkdf2
    * salt            string:          Hash salt. Used for simple password_scheme
    * type            string:          Document type. Constantly has the value user
*/

const test_auth = {
    username: "test1",
    password: "apple"
}

const proxy_auth = {
    username: UNCOMMITTED,
    password: UNCOMMITTED,
}

/**
 * String literal of code that is run in couchdb,
 * when add_prelude is called with another function.
 */
let couch_js_prelude = (function() {
    const MEMBER_PREFIX='member_';
    const LEADER_PREFIX='leader_';
    const includes = function(array, searchElement, fromIndex) {
        return array.lastIndexOf(searchElement) >= (fromIndex || 0);
    };
    const diff_ = function(user1, user2) {

    }
}).toString();
// Slice away the function() and Curly brackets
couch_js_prelude = couch_js_prelude.slice(couch_js_prelude.indexOf('{')+1, couch_js_prelude.lastIndexOf('}'))

function add_prelude(func_js) {
    const func = func_js.toString();

    // This is split based on where the prelude must be inserted:
    // After the first '{'
    const func_declaration = func.slice(0, func.indexOf('{') + 1);
    const func_rest = func.slice(func.indexOf('{') + 1);

    if(func_declaration.indexOf('=>') >= 0) { 
        throw 'add_prelude must receive ES5-Compatible functions, arrow syntax is not supported.'
    }

    return func_declaration + couch_js_prelude + func_rest;
}

const presets = [
    // {
    //     db: '_users',
    //     doc_id: '_security',
    //     data: {
    //         "members":{
    //             "roles":["_admin"]
    //         },
    //         "admins":{
    //             "roles":["_admin"]
    //         }
    //     }
    // },
    {
        db: 'directory',
        doc_id: '_design/permissions',
        data: {
            "validate_doc_update": add_prelude(function(newDoc, oldDoc, userCtx) {
                if(!includes(userCtx.roles, '_admin')) {
                    throw({unauthorized: "Access denied. Only server admin may update the directory"});
                }
            })
        }
    },
    {
        db: '_users',
        doc_id: '_design/permissions',
        data: {
            "validate_doc_update": add_prelude(function(newDoc, oldDoc, userCtx) {
                if(!includes(userCtx.roles, "user_manager") && !includes(userCtx.roles, "_admin")) {
                    throw({unauthorized: "Access denied. Only the FAIMS server may change devices"});
                }

                if(!includes(userCtx.roles, "_admin") && (
                    !newDoc.user || typeof(newDoc.user) !== 'string'
                )) {
                    throw({forbidden: "'user' field required to be an id string"})
                }
            })
        }
    },
    {
        db: 'data-lake_mungo',
        doc_id: '_design/permissions',
        data: {
            "validate_doc_update": add_prelude(function(newDoc, oldDoc, userCtx) {
                if(
                    !includes(userCtx.roles, '_admin') && 
                    !includes(userCtx.roles, MEMBER_PREFIX + 'lake_mungo') &&
                    !includes(userCtx.roles, LEADER_PREFIX + 'lake_mungo') &&
                    !newDoc.deleted && oldDoc == null
                ) {
                    throw({unauthorized:"You must be a member of the team to write to this database"});
                }
            })
        }
    },
    {
        db: 'data-lake_mungo',
        doc_id: '_design/validation',
        data: {
            "validate_doc_update": add_prelude(function(newDoc, oldDoc, userCtx) {
                if(!newDoc.history || typeof(newDoc.history) !== 'array') {
                    throw({forbidden:"'author' field required to be an array"})
                }

                //TODO
            })
        }
    },
    {
        db: 'people',
        doc_id: '_design/permissions',
        data: {
            "validate_doc_update": add_prelude(function(newDoc, oldDoc, userCtx) {
                if(userCtx.roles.indexOf('_admin') >= 0) {
                    return;
                }

                if(!includes(userCtx.roles, 'user_manager')) {
                    // Regular users: Check for more restrictions
                    // A regular user attempting to modify something about themselves:
                    // they can't create themselves (but they can delete themselves)
                    // And roles cannot be changed, since that requires syncing devices
                    // And devices cannot be modified either, for the same reason
                    if(oldDoc == null) {
                        throw({unauthorized: "Access denied. Only the FAIMS server may add users."});
                    } else if(newDoc.deleted) {
                        throw({unauthorized: "Access denied. Only the FAIMS server may delete users"});
                    } else if(JSON.stringify(newDoc.roles) != JSON.stringify(oldDoc.roles)) {
                        throw({unauthorized: "Access denied. Only the FAIMS server may change roles"});
                    } else if(JSON.stringify(newDoc.devices) != JSON.stringify(oldDoc.roles)) {
                        throw({unauthorized: "Access denied. Only the FAIMS server may change devices"});
                    }
                }
            })
        }
    }
];

async function sync_preset(preset, db) {
    let existing;
    try {
        existing = await db.get(preset.doc_id);
    } catch(err) {
        if(err.error == 'not_found') {
            // Post in a new version
            // console.log('CREATE ' + JSON.stringify(preset.data));

            await db.put({
                _id: preset.doc_id,
                ...preset.data
            });
            return;
        } else {
            throw err;
        }
    }
    
    const replacing_rev = existing._rev;

    // Allows for JSON.stringify comparison
    delete existing._id;
    delete existing._rev;

    // This isn't guaranteed to elude the case that they're equal
    // but it WILL make sure that if they're not equal, it will modify
    if(JSON.stringify(existing) != JSON.stringify(preset.data)) {
        await db.put({
            '_id': preset.doc_id,
            '_rev': replacing_rev,
            ...preset.data
        });

        console.log('synced:  ' + db.name + '/' + preset.doc_id);
    } else {
        console.log('checked: ' + db.name + '/' + preset.doc_id);
    }
}

let _remoteDBs = {};
const remoteDB = (db_name, auth) => {
    let key = db_name + auth.username + auth.password;
    if(_remoteDBs[key] == null) {
        _remoteDBs[key] = new PouchDB(dbinfo.url_noauth + '/' + db_name, {
            skip_setup:true,
            auth: auth
        });
    }
    return _remoteDBs[key];
}

async function main() {
    for(let i = 0; i < presets.length; i++) {
        const preset = presets[i];
        try {
            await sync_preset(preset, remoteDB(preset.db, dbinfo.auth));
        } catch(err) {
            console.error(err);
        }
    }

}

main().catch(console.error);