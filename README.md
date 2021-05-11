# FAIMS3

FAIMS3 is currently in pre-alpha development. This repository is our main
codebase for development. See <https://faims.edu.au> for updates (soon).

## Setup and development (quick-start)

Before you do anything (apart from cloning this repository), you should run
npm install`to get all the dependencies
for the scripts installed (If you have been doing some development, either
stashing or committing your changes before
running`npm install` would be wise).

Once the dependencies are installed, you should check any changes that have been
made, and commit them if needed.

There are a number of helper scripts (which can be seen in the `package.json`),
but the ones that should always exist
are:

* `npm run build`: builds the webapp (not the Android/iOS apps)
* `npm run test`: runs the main test suite
* `npm run serve`: runs the webapp in a browser (currently via capacitor's
   system, to ensure that the webapp and the phone apps are as similar as
   possible).
* `npm run start`: runs the webapp in a browser (unoptimized dev build).

You should also be aware of the
[cli interface to capacitor](https://capacitorjs.com/docs/cli), as that does the
building/management of the Android/iOS
apps.

## Choosing couchdb instances

The `server_configs` directory contains sourcable scripts for some of the
development servers, but primarily exporting:

```!shell
export REACT_APP_DIRECTORY_HOST=<couchdb_host_name>
export REACT_APP_DIRECTORY_PORT=<couchdb_port>
```

will allow you to choose which couchdb instance to use. Remember to add the
host-port pair of the system the *FAIMS* app is running on (in most cases
`localhost:3000`) to the CORS allow list via the Fauxton running on the couchdb
server (located at <<http://<couchdb_host_name>:<couchdb_port>/_utils/>>).
