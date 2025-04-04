# FAIMS3-conductor

[![codecov](https://codecov.io/gh/FAIMS/FAIMS3-conductor/branch/main/graph/badge.svg?token=CJ4U0H7AKA)](https://codecov.io/gh/FAIMS/FAIMS3-conductor)

The server-side of FAIMS3 handling authentication and authorization

To get started, first set up the `.env` file as specified in Configuration, and
then set up keys as specified in Running.

## Configuration

The deployment is configured via the `.env` file in the root directory
of the project.  Copy `.env.dist` to `.env` and the update the values
as required.  See the deployment docs for full details of the environment
variables supported.

Environment variables are documented in comments in `.env.dist`.

## Key Generation

```bash
./keymanagement/makeInstanceKeys.sh
```

generates new key pair in the `keys` folder and generates the `local.ini` file for couchdb
that contains the public key and other information.

## Running with Docker

Build the two docker images:

```bash
docker compose build
```

Then we can startup the servers:

```bash

docker compose up -d
```

will start the couchdb and conductor servers to listen on the configured port.

## Running with Node

If you don't plan to use Docker to run or deploy Conductor, you need to get CouchDB
running on your host and enter the appropriate addresses in the `.env` file. 
To run the Conductor server you first need to install dependencies:

```bash
npm install
```

You should then be able to run the server with:

```bash
npm start
```

If you are developing, you may want to run:

```bash
npm run watch
```

instead, which will monitor for changes with `nodemon`.

## Initialisation

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

## Deploying a notebook

Notebooks can be uploaded to Conductor via the web interface.

## Development

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

## Tests

Run tests inside the conductor instance:

```bash

docker compose exec conductor npm run test
```
