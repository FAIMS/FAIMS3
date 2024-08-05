# FAIMS3

FAIMS3 is an open-source tool for offline field data-collection brought to you by the FAIMS Project. The FAIMS Project was funded by the ARDC ([https://dx.doi.org/10.47486/PL110]), Macquarie University, and CSIRO along with our other partners. 

## Versioning 

TODO document

## Directory Structure

The repository contains the following:

- /api: contains the conductor
- /app: contains the the web, Android and iOS applications
- /designer: contains designer web application
- /docs: contains the high level documentation for the project
- /infrastucture: contains the AWS CDK deployment scripts
- /library: shared library for the project
- /tests: contains the end-to-end tests for the project

## Initial Setup

Clone the repository and install node modules (note this only needs to be run from the parent folder)

```bash
npm install
```

Create the .env file by copying the .env.dist file and updating the values

```bash
cp ./api/.env.dist ./api/.env && 
cp ./app/.env.dist ./app/.env && 
code ./api/.env && 
code ./app/.env
```

## API Setup

### Key Generation

```bash
./api/keymanagement/makeInstanceKeys.sh ./api/.env
```

generates new key pair in the `keys` folder and generates the `local.ini` file for couchdb
that contains the public key and other information.

### Running with Docker

Build the two docker images:

```bash
docker compose -f api/docker-compose.dev.yml build
```

Then we can startup the servers:

```bash
cd api && docker compose up -d; cd ..
```

will start the couchdb and conductor servers to listen on the configured port.

### Running with Node

If you don't plan to use Docker to run or deploy Conductor, you need to get CouchDB
running on your host and enter the appropriate addresses in the `.env` file.

You should then be able to run the server with:

```bash
npm run start-api
```

If you are developing, you may want to run:

```bash
npm run watch-api
```

instead, which will monitor for changes with `nodemon`.

### Initialisation

Once the services are up and running we need to initialise the CouchDB
database. This is done by sending a request to the API via a short script.
This operation will create a local user called `admin` with the same password
as configured for CouchDB (`COUCHDB_PASSWORD` in `.env`).  The script will
have no effect if the admin user is already set up.  Run the script with:

```bash
npm run initdb
```

There is also a script that will populate the database with notebooks that are
stored in the `notebooks` directory.  There should be two sample notebooks in
there but you can also create new ones.

This script requires authentication, so you need to get a user token for the admin
user. First, connect to the conductor instance on <http://localhost:8080/> or whatever
port you have configured. Login using the local `admin` user and password.
Now, from the Conductor home page (<http://localhost:8080/>) scroll down to "Copy
Bearer Token to Clipboard". Paste this value into your .env file as the
value of USER_TOKEN.

```bash
npm run load-notebooks
```

## Developer notes to run test copies of FAIMS

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

- `npm run build-app`: builds the webapp (not the Android/iOS apps)
- `npm run test-app`: runs the main test suite
- `npm run serve-app`: runs the webapp in a browser (currently via capacitor's
  system, to ensure that the webapp and the phone apps are as similar as
  possible).
- `npm run start-app`: runs the webapp in a browser (unoptimized dev build).

You should also be aware of the
[cli interface to capacitor](https://capacitorjs.com/docs/cli), as that does the
building/management of the Android/iOS
apps.

Further build/install instructions can be found at
<https://github.com/FAIMS/FAIMS3/wiki/building-the-webapp>.

## Build mobile app

1. Build the source code
   - `npm run webapp-build`
1. Synchronise Gradle files
   - `npm run webapp-sync` OR `cap sync`
1. [Optional] Allow to copy to /Library/Ruby/Gems/2.3.0:
   - `export GEM_HOME="$HOME/.gem"`
1. [Optional] Resolve `xcode-select` error
   - `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
1. Build the apk from the build/build bundle/build apk section

## API Development

There is an alternate docker compose file for development that mounts the
current working directory inside the container so that you can work on
code in real time.  To use this you also need a local `node_modules` folder
since the current directory will shadow the one inside the container. 

To create `node_modules` run `npm ci` inside the container:

```bash
docker compose -f docker-compose.dev.yml run conductor npm ci
```

Then start the services:

```bash
docker compose -f docker-compose.dev.yml up
```

## API Tests

Run tests inside the conductor instance:

```bash

docker compose exec conductor npm run test
```
