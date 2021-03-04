const http = require('http');
const util = require('util');
const dbinfo = require('./dbinfo.js');

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

const test_name = 'test1';
const test_pass = 'apple';
const test_db = 'authorization_test';

let cookies = [];

const design_docs = {
    
};

function database_call(method, url, body=null, headers={}) {
    return new Promise((resolve, reject) => {
        let options = {
            ...dbinfo.options,
            path: '/' + url,
            method: method,
            headers: {
                ...headers,
                "Cookie": cookies
            }
        };

        if(body != null && method == 'GET') {
            options.path += '?' + new URLSearchParams(body).toString();
        } else if(body != null && !options.headers["Content-Type"]) {
            options.headers["Content-Type"] = 'application/json';
        }

        const request = http.request(options, async (res) => {
            try {
                let rawData = '';
                res.on('data', chunk => {rawData += chunk;});
                res.on('end', () => {
                    if(!res.complete) {
                        reject(res);
                    } else {
                        resolve([rawData, res]);
                    }
                })
            } catch(e) {
                reject(e);
            }
        });
        request.on('error', reject);
        if(body != null && method != 'GET') {
            request.write(JSON.stringify(body));
        }
        request.end();
    });
}

function create_db(db_name) {
    return database_call('PUT', db_name).then(async ([d, res]) => {
        if(res.statusCode >= 200 && res.statusCode < 300) {
            console.info("Create DB: " + d);
            await secure_db(db_name);
            await design_db(db_name);
            resolve();
        } else {
            console.info("Create DB: " + d)
            let data = JSON.parse(d);
            if(data['error'] && data['error'] == 'file_exists') {
                console.info("Continuing on existing DB");
                await secure_db(db_name);
                await design_db(db_name);
                resolve();
            }
        }
    });
}

function design_db(db_name) {
    return database_call('GET', '_design_docs', {conflicts:true,include_docs:true}).then(([d, res]) => {
        console.info("Design DB: " + d);
    });
}

function try_insert(db_name, to_insert) {
    return database_call('POST', db_name, to_insert, {
        "Accept": "application/json; text/plain",
        "Content-Type": "application/json"
    }).then(([d, res]) => {
        console.info("Try insert : " + d);
    })
}

function secure_db(db_name) {
    return database_call('PUT', db_name + '/_security', {
        "admins": {
            "names": [], "roles": []
        },
        "members":
        {
            "names": [test_name], "roles": []
        } 
    }).then(([d, res]) => {
        console.info("Secure DB: " + d);
        return database_call('GET', db_name + '/_security').then(([d, res]) => {
            console.info("Secured DB: " + d);
        });
    });
}

function create_user() {
    return database_call('PUT', '_users/org.couchdb.user:' + test_name, {
        name: test_name,
        password: test_pass,
        roles: [],
        type: "user"
    }, {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }).then(([d, res]) => {
        console.info("Create User: " + d)
    });
}

function get_user() {
    return database_call('GET', '_users/org.couchdb.user:' + test_name).then(([d, res]) => {
        console.info("User: " + d)
    });
}

function parse_cookie(cookies) {
    all_cookies = [];
    cookies.forEach(cookie_string => {
        let semicolon_split = cookie_string.split(';');
        let output_cookie = {};
        let first_name = null;
        semicolon_split.forEach(part => {
            let [name, value] = part.trim().split('=');
            output_cookie[name] = value;
            first_name = first_name || name;
        });
        all_cookies += first_name + '=' + output_cookie[first_name];
    });
    return all_cookies;
}

function login(username, password) {
    return database_call('POST', '_session', {
        name: username,
        password: password
    }).then(([d, res]) => {
        console.info("Session: " + d);
        console.info("Headers:" + JSON.stringify(res.headers));
        if(res.headers['set-cookie']) {
            cookies = parse_cookie(res.headers['set-cookie']);
            console.info("Cookie: " + cookies);
        }
    });
}

async function main() {
    await login(dbinfo.username, dbinfo.password);
    await create_db(test_db);
}
main();

// design_db('_users')

// login(test_name, test_pass, try_insert);