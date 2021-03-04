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

function on_res_end(res) {
    return new Promise((resolve, reject) => {
        let rawData = '';
        res.on('data', (chunk) => {rawData += chunk;});
        res.on('end', () => {
            if(!res.complete) {
                reject(res);
            } else {
                resolve(rawData);
            }
        })
    })
}

function create_db(db_name) {
    const options = {
        ...dbinfo.options,
        path: '/' + db_name,
        method: 'PUT',
        headers: {
            "Cookie":cookies 
        }
    }
    return new Promise((resolve, reject) => {
        const req = http.request(options, async (res) => {
            if(res.statusCode >= 200 && res.statusCode < 300) {
                let d = await on_res_end(res);
                console.info("Create DB: " + d);
                await secure_db(db_name);
                await design_db(db_name);
                resolve();
            } else {
                let d = await on_res_end(res);
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
        req.on('error', error => {
            console.error(error);
            reject(error);
        });
        req.end();
    })
}

function design_db(db_name) {
    const params = new URLSearchParams({
        conflicts: true,
        include_docs:true
    })
    const options = {
        ...dbinfo.options,
        path: '/' + db_name + '/_design_docs?' + params.toString(),
        method: 'GET',
        headers: {
            "Cookie": cookies
        }
    };
    return new Promise((resolve, reject) => {
        const req = http.request(options, async (res) => {
            let d = await on_res_end(res);
            console.info("Design DB: " + d);
            resolve();
        });
        req.on('error', error => {
            console.error(error);
            reject(error);
        });
        req.end();
    })
}

function try_insert(db_name, to_insert) {
    const options = {
        path: '/' + db_name,
        method: 'POST',
        headers: {
            "Cookie": cookies,
            "Accept": "application/json; text/plain",
            "Content-Type": "application/json"
        }
    };
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(to_insert);
        const req = http.request(options, async (res) => {
            let d = await on_res_end(res);
            console.info("Try insert : " + d);
            resolve();
        });
        req.on('error', error => {
            console.error(error);
            reject(error);
        });
        req.write(body);
        req.end();
    })
}

function secure_db(db_name) {
    const options = {
        ...dbinfo.options,
        path: '/' + db_name + '/_security',
        method: 'PUT',
        headers: {
            "Cookie":cookies 
        }
    }
    const body = JSON.stringify({
        "admins": {
            "names": [], "roles": []
        },
        "members":
        {
            "names": [test_name], "roles": []
        } 
    });
    return new Promise((resolve, reject) => {
        const req = http.request(options, async (res) => {
            let d = await on_res_end(res);
            console.info("Secure DB: " + d)
            resolve();
        });
        req.on('error', error => {
            console.error(error);
            reject(error);
        });
        req.write(body);
        req.end();
    });
}

function create_user() {
    const options = {
        ...dbinfo.options,
        path: '/_users/org.couchdb.user:' + test_name,
        method: 'PUT',
        headers: {
            ...dbinfo.headers,
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Cookie': cookies
        }
    };
    const body = JSON.stringify({
        name: test_name,
        password: test_pass,
        roles: [],
        type: "user"
    })
    return new Promise((resolve, reject) => {
        const req = http.request(options, async (res) => {
            let d = await on_res_end(res);
            console.info("Create User: " + d)
            resolve();
        });
        req.on('error', error => {
            console.error(error);
            reject(error);
        });

        req.write(body);
        req.end();
    });
}

function get_user() {
    const options = {
        ...dbinfo.options,
        path: '/_users/org.couchdb.user:' + test_name,
        method: 'GET',
        headers: {
            "Cookie":cookies 
        }
    };
    return new Promise((resolve, reject) => {
        const req = http.request(options, async (res) => {
            let d = await on_res_end(res); 
            console.info("User: " + d)
            resolve();
        });
        req.on('error', error => {
            console.error(error);
            reject();
        });
        req.end();
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
    const options = {
        ...dbinfo.options,
        path: '/_session',
        method: 'POST',
        headers: {
            ...dbinfo.headers,
            'Content-Type': 'application/json',
        }
    };
    const body = JSON.stringify({
        name: username,
        password: password
    })
    return new Promise((resolve, reject) => {
        const req = http.request(options, async (res) => {
            let d = await on_res_end(res);
            console.info("Session: " + d);
            console.info("Headers:" + JSON.stringify(res.headers));
            if(res.headers['set-cookie']) {
                cookies = parse_cookie(res.headers['set-cookie']);
                console.info("Cookie: " + cookies);
            }
            resolve();
        });
        req.on('error', error => {
            console.error(error);
            reject(error);
        });

        req.write(body);
        req.end();
    });
}

async function main() {
    await login(dbinfo.username, dbinfo.password);
    await create_db(test_db);
}
main();

// design_db('_users')

// login(test_name, test_pass, try_insert);