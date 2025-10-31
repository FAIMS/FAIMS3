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

### Prerequisites

You'll need Node.js 22 and pnpm installed. We strongly recommend
using [`nvm`](https://github.com/nvm-sh/nvm) (node version manager).

Install and activate Node v22:

```bash
nvm install 22
nvm use 22
```

You will also need Docker and Docker Compose installed.

### Starting all services

Run the script to get all services running locally:

```bash
./localdev.sh --all
```

This spins up four services:

- Conductor API (`/api`) live reloading on http://localhost:8080
- FAIMS3 app (`/app`) live reloading on http://localhost:3000
- Web app (`/web`) live reloading on http://localhost:3001
- CouchDB on http://localhost:5984/\_utils

### Additional options

- **Rebuild containers**: Use `--build` flag to rebuild Docker images

  ```bash
  ./localdev.sh --all --build
  ```

- **Clear database**: Use `--clear-db` flag to prune volumes and so clear
any existing database content

  ```bash
  ./localdev.sh --all --clear-db
  ```

## CouchDB-only local development (recommended for live-reloading)

If you prefer to run the application services natively and only use Docker for CouchDB:

1. Start CouchDB only (default behaviour without `--all` flag):

```bash
./localdev.sh
```

This starts CouchDB on http://localhost:5984/\_utils

2. Migrate the CouchDB:

```bash
pnpm run migrate-with-keys
```

3. Run development services natively (in a separate terminal):

```bash
pnpm run dev
```

This runs:

- web: http://localhost:3001
- app: http://localhost:3000
- api: http://localhost:8080

Use the admin user/password from `api/.env` to login.

These three commands are bundled into `dev.sh` i.e.

```bash
./dev.sh
```

## Manual Setup 

These steps are done by the `localdev.sh` script but in case you want to do them manually they are listed here.

### Initial step-by step setup

Clone the repository and install node modules (note this only needs to be run from the parent folder)

```bash
pnpm install
```

Create the .env file by copying the .env.dist file and updating the values

```bash
cp ./api/.env.dist ./api/.env &&
cp ./app/.env.dist ./app/.env &&
code ./api/.env &&
code ./app/.env
```

### API Setup

#### Key Generation

The system requires a key pair to sign the JWT used for communication with the CouchDB database.
The private key must be known to the API server and is used to sign the JWT. The public key is shared
with the CouchDB instance to verify JWTs.

There are different ways for the API to get hold of the keys at runtime based on the KEY_SOURCE
environment variable:

- `KEY_SOURCE='FILE'` - look in the `keys` folder for the keys (default)
- `KEY_SOURCE='ENV'` - look in the environment for `PRIVATE_SIGNING_KEY` and `PUBLIC_SIGNING_KEY` which
  should be base64 encoded versions of the keys
- `KEY_SOURCE='AWS_SM'` - use an AWS secret store, `AWS_SECRET_KEY_ARN` must be set to allow access

For development the simplest way to work is with a file based source. You can generate suitable keys
by running:

```bash
pnpm run generate-local-keys
```

this generates new key pair in the `keys` folder in the `api` folder and generates the `local.ini` file
for couchdb that contains the public key and other information. This uses the script
located at `./api/keymanagement/makeInstanceKeys.sh`.

#### Running with Docker

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

#### Running with Node

If you don't plan to use Docker to run or deploy Conductor, you need to get CouchDB
running on your host and enter the appropriate addresses in the `.env` file.

You should then be able to run the server with:

```bash
pnpm run start-api
```

If you are developing, you may want to run:

```bash
pnpm run watch-api
```

instead, which will monitor for changes with `nodemon`.

#### Initialisation

Once the services are up and running we need to initialise the CouchDB
database. This is done by sending a request to the API via a short script.
This operation will create a local user called `admin` with the same password
as configured for CouchDB (`COUCHDB_PASSWORD` in `.env`). The script will
have no effect if the admin user is already set up. Run the script with:

```bash
pnpm run migrate-with-keys
```

There is also a script that will populate the database with notebooks that are
stored in the `notebooks` directory. There should be two sample notebooks in
there but you can also create new ones.

```bash
pnpm run load-notebooks
```

## IOS Notes

To build the IOS app locally you need to be on MacOS. A number of the build
files for IOS are generated from configuration variables in the `app/.env`
file. These must be set for the build to work, in particular the
development team might need to be set to a valid team id for the build
to work.

Before building the IOS app run

```bash
pnpm run configIOSbuild
```

in the `app` directory. This modifies two build files. See the notes on
[IOS Deployment](docs/developer/docs/source/markdown/IOS-Deployment.md) for
more details. That documents the CI workflows but some of it applies for
local builds.

## Developer notes to run test copies of FAIMS

Before you do anything (apart from cloning this repository), you should run
pnpm install`to get all the dependencies
for the scripts installed (If you have been doing some development, either
stashing or committing your changes before
running`pnpm install` would be wise).

Once the dependencies are installed, you should check any changes that have been
made, and commit them if needed.

There are a number of helper scripts (which can be seen in the `package.json`),
but the ones that should always exist
are:

- `pnpm run build-app`: builds the webapp (not the Android/iOS apps)
- `pnpm run test-app`: runs the main test suite
- `pnpm run serve-app`: runs the webapp in a browser (currently via capacitor's
  system, to ensure that the webapp and the phone apps are as similar as
  possible).
- `pnpm run start-app`: runs the webapp in a browser (unoptimized dev build).

You should also be aware of the
[cli interface to capacitor](https://capacitorjs.com/docs/cli), as that does the
building/management of the Android/iOS
apps.

Further build/install instructions can be found at
<https://github.com/FAIMS/FAIMS3/wiki/building-the-webapp>.

## Build mobile app

1. Build the source code
   - `pnpm run webapp-build`
1. Synchronise Gradle files
   - `pnpm run webapp-sync` OR `cap sync`
1. [Optional] Allow to copy to /Library/Ruby/Gems/2.3.0:
   - `export GEM_HOME="$HOME/.gem"`
1. [Optional] Resolve `xcode-select` error
   - `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
1. Build the apk from the build/build bundle/build apk section

## Live reload Android studio workflow (WSL)

On WSL, the following setup and procedure allows live reloading of the app on an Android emulator (or physical device through adb [though I haven't gotten this working due to adb config issues]).

### Prereqs

- install Android studio on your WSL instance with suitable JDK (this usually comes bundled)

### Setup

First run `pnpm i` to install all dependencies, and move into `/app`. Then `pnpm i` to be certain local deps are installed, then

- open android studio in one tab i.e. `./<studio path>/studio.sh`
- in the open studio window, configure/start the emulator you want to run it on
- in another tab, build the app i.e. `pnpm run build && npx cap sync android`
- run the server `npx vite --force`
- in another tab, start live reload `npx cap run android -l --external` and select the desired running emulator (it's important you use the existing running emulator rather than starting another which is unstable with WSL)

This then live reloads on the emulator device from the running server.

## API Development

There is an alternate docker compose file for development that mounts the
current working directory inside the container so that you can work on
code in real time. To use this you also need a local `node_modules` folder
since the current directory will shadow the one inside the container.

To create `node_modules` run `pnpm install` inside the container:

```bash
docker compose -f api/docker-compose.dev.yml run conductor pnpm install
```

Then start the services:

```bash
docker compose -f api/docker-compose.dev.yml up
```

## API Tests

Run tests inside the conductor instance:

```bash

docker compose exec conductor pnpm run test
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
