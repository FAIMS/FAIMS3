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

Further build/install instructions can be found at
<https://github.com/FAIMS/FAIMS3/wiki/building-the-webapp>.

### Docker Desktop setup
1. Install [Docker desktop](https://www.docker.com/get-started/).
1. Create a new `Dev Environment`.
1. When prompted for `Existing Git repo` add the FAIMS3 git repo web address.
1. Click on `Open in VSCode` which will open your new container.
1. Then follow `Setup and development (quick-start)` steps inside of the VSCode which was opened.

### (Alternatively) Use the terminal to create containers with Docker
1. Install docker with brew using `brew install docker`.
1. Clone repository to your local machine.
1. Spin up a new Ubuntu container with your local machine location of the repository and give it a CONTAINERNAME of your choice `docker run -dt -v /LOCAL_REPO_LOCATION:/opt/projects -p 3000-4000:3000-4000 --name CONTAINERNAME ubuntu /bin/bash`
1. Check the container was created successfully with `docker container list -a`.
1. If successfuly enter the container environment using `docker exec -it CONTAINERNAME bash`
1. Update linux package sources list to the latest and upgrade the current packages installed to latest versions with `apt update && apt upgrade`, type `y` and press enter for any prompts to allow installs to use disk space.
1. Install curl and fetch node with `apt install curl` then `curl -fsSL https://deb.nodesource.com/setup_16.x | bash -` to fetch node and make it visible to bash.
1. Install required tools for the project to run with `apt install gcc g++ make nodejs` which installs GNU Compiler Collection, GNU c++ compiler, Make unix utility and Nodejs.
1. Enter project folder `cd /opt/projects`.
1. Now follow `Setup and development (quick-start)`.

* To exit container use `exit` command.
* To stop container use `docker stop CONTAINERNAME`
* To remove container use `docker rm CONTAINERNAME`

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
server (located at `http://<couchdb_host_name>:<couchdb_port>/_utils/`).
