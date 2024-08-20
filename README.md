# FAIMS3

FAIMS3 is an open-source tool for offline field data-collection brought to you by the FAIMS Project. The FAIMS Project was funded by the ARDC ([https://dx.doi.org/10.47486/PL110]), Macquarie University, and CSIRO along with our other partners.

## Directory Structure

The repository contains the following:

- /api: contains the conductor
- /app: contains the the web, Android and iOS applications
- /designer: contains designer web application
- /docs: contains the high level documentation for the project
- /infrastucture: contains the AWS CDK deployment scripts
- /library: shared library for the project
- /tests: contains the end-to-end tests for the project

## Local development quick start

Ensure you have uuid installed e.g.

```bash
sudo apt-get install uuid
```

Also check you have a modern npm installed, ideally v10.x.y.

We recommend using [`nvm`](https://github.com/nvm-sh/nvm) (node version manager). To set this up

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
```

You may then need to update your bash profile, for example by either starting another terminal session or running

```bash
source ~/.bashrc
```

You can then setup Node v20 and activate it

```bash
nvm install 20
nvm use 20
```

You will also need docker and docker compose installed rootless.

Now run the script to get a docker service running locally.

```bash
./localdev.sh
```

## Initial step-by step setup

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
npm run generate-local-keys
```

generates new key pair in the `keys` folder in the `api` folder and generates the `local.ini` file for couchdb that contains the public key and other information. This uses the script located at `./api/keymanagement/makeInstanceKeys.sh`.

### Running with Docker

Build the two docker images:

```bash
docker compose -f api/docker-compose.dev.yml build
```

Then we can startup the servers - if you want to monitor the output use

```bash
docker compose -f api/docker-compose.dev.yml up
```

Or if you'd like to run it in the background

```bash
docker compose -f api/docker-compose.dev.yml up -d
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
as configured for CouchDB (`COUCHDB_PASSWORD` in `.env`). The script will
have no effect if the admin user is already set up. Run the script with:

```bash
npm run initdb
```

There is also a script that will populate the database with notebooks that are
stored in the `notebooks` directory. There should be two sample notebooks in
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
code in real time. To use this you also need a local `node_modules` folder
since the current directory will shadow the one inside the container.

To create `node_modules` run `npm ci` inside the container:

```bash
docker compose -f api/docker-compose.dev.yml run conductor npm ci
```

Then start the services:

```bash
docker compose -f api/docker-compose.dev.yml up
```

## API Tests

Run tests inside the conductor instance:

```bash

docker compose exec conductor npm run test
```

## Production docker builds

This repo contains a `Dockerfile.build` which is designed to build and package a Node.js application in a multi-stage process, optimized for monorepo structures using Turborepo.

### Stages:

1. **Base**: Sets up the Alpine Node.js 20 environment with necessary dependencies.
2. **Pruner**: Uses Turborepo to prune the monorepo, isolating the specified package and its dependencies.
3. **Builder**: Installs dependencies, builds the project, and bundles necessary files.
4. **Runner**: Creates a minimal production image to run the built application.

### Usage:

To build a package (e.g., `@faims3/api`) with the build output in a specific directory (e.g., `/api/build/src`):

```bash
docker build -f Dockerfile.build \
             --build-arg PACKAGE_NAME=@faims3/api \
             --build-arg NODE_RUN_DIR=api/build/src \
             -t your-image-name .
```

### bundle.sh

`bundle.sh` is a script which utilises the output of the `turbo prune <target> --docker` command. It leverages the existence of `package.json` files at directories to determine necessary build paths to copy when bundling a Node based Dockerimage. It currently copies the following folder

- node_modules
- build
- dist
- views (for the API specifically)

`realpath` could not be used because `alpine` images do not support `--relative-to` meaning a custom function is included which finds relative paths.

I would not recommend using this script for local work, it is predominately to help the Docker build be able to resolve dependencies without any manual intervention while still building a pruned output image.

```bash
# Helper script used for docker builds.

# bundle.sh: A script to copy specific directories from a source to an output location
# based on the presence of package.json files in a JSON dump directory.

# Usage: ./bundle.sh <json_dump_path> <source_path> <output_path>
#
# Arguments:
#   json_dump_path: Path to the directory containing package.json files
#   source_path: Path to the source directory containing files to be copied
#   output_path: Path to the output directory where files will be copied
```
