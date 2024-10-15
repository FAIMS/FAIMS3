# Deploying the App on the Google Play Store

Here we document the process of deployment of the Android app on the Play Store.

## Pre-requisites

### Google Cloud Project

The workflow needs to be able to access the Google Play API and to do this we need
to set up a project on [Google Cloud](https://console.cloud.google.com/) and give it
permission to access the API. There are instructions on creating a Service Account Key on
the [Runway Documentation](https://docs.runway.team/integrations/app-stores/google-play-console#service-account-api-key-setup) page.  

You are creating a 'service account' which is effectively a proxy account that can
access the API.  You will give that account email permission to access the project
on Google Play. When you create the service account you will download a file containing 
the private key for that account (eg. `fieldmark-app-deployment-c243ef36afb3.json`). 
We will use that below to configure the pipeline for app upload.

## Workflow

Workflow `nightly-android-testbuild.yml` does a nightly build and deploy to the app store test stream.

Here are the steps.

### Configure Turborepo Remote Cache

Configures a turborepo build cache so that previous builds can be used if there
are no changes. 

Uses: `TURBO_API_URL`, `TURBO_TEAM` variables. `TURBO_TOKEN` secret. 

Example values (from the current CSIRO backed chache).

```bash
TURBO_API_URL=https://bss.turbocache.webapp.csiro.au
TURBO_TEAM=ducktors
```

If this is not configured the build should still work but will build everything from scratch.

### Checkout

Checkout the latest version of the code.

### Cache Node Modules

Sets up and/or restores a cache of node modules to speed up npm install

### Install `jq`

A command line JSON processor

### Declare Some Variables

Set up `sha_short`, a short hash of the latest git commit and `app_version` which pulls the app version string from `app/package.json` using `jq`. 

### Create Version String

Make a version string for the app based on the two variables from the last step

Version is eg. `1.0.0-android-#AAAFFFEEE`

### Cache Gradle Packages

Set up and/or restore a cache of gradle packages for the app build

### Use Node.js <version>

Selects the version of Node to use, currently version 20 (from matrix setting above)

### Set up adopt JDK 1.17

Get the right Java version for the build

### Set up ruby env

Ruby is used for running `fastlane` to automate the upload to the app store.

### Decode Service Account Key JSON File

Decode the `GPLAY_SERVICE_ACCOUNT_KEY_JSON` secret that contains a base64 encoded
version of the Google Cloud Service Account key which you created earlier.

### Decode Keystore File

Decode the `KEYSTORE_FILE` secret that contains the base64 encoded content of the
key store. (How do we make this?)

### Setup Android SDK

Runs the action to make the SDK available to the build.

### Building Webapp



## Fastlane Notes




### Variables and Secrets for deployment

- `vars.TURBO_TEAM`
- `vars.TURBO_API_URL`
- `vars.NIGHTLY_CONDUCTOR_URL`

- `secrets.TURBO_TOKEN`
- `secrets.GPLAY_SERVICE_ACCOUNT_KEY_JSON` - bases64 encoded version of service account key
- `secrets.KEYSTORE_FILE` - contents of android-signing-keystore.jks (as base64?)
- `secrets.BUGSNAG_KEY`
- `secrets.JAVA_KEYSTORE_PASSWORD`
- `secrets.JAVA_KEY_PASSWORD`

