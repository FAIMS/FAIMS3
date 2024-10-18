# Deploying the App on the Google Play Store

Here we document the process of deployment of the Android app on the Play Store.
Based on the example given in [this Runway blog post](https://www.runway.team/blog/ci-cd-pipeline-android-app-fastlane-github-actions).

## Pre-requisites

### Create Google Play App

The automated process below can only work once we have created an app on the
Google Play console and uploaded a first version app bundle.  This means we need
to do a local build, sign it with an _upload key_ and upload it to the
Google Play console manually.

Sign in to the Google Play console and create a new app. Fill in the required
details following the workflow prompts.  

Build the app and open up Android Studio:

```bash
npm run build
cd app
npx cap sync android
npx cap open android
```

Inside Android Studio, create a production build. To do this you'll need to generate
an _upload key and keystore_, there are instructions 
[on android.com](https://developer.android.com/studio/publish/app-signing#sign-apk).
Basically you select "Generate Signed Bundle or API" from the Build menu and follow the
prompts. This will get you to generate a new keystore file, key name and password.  
Make a note of these, we'll create repository secrets for them on Github:

- `secrets.KEYSTORE_FILE` - java key store file, base64 encoded
- `secrets.JAVA_KEY_PASSWORD` - password for the Java keystore
- `secrets.JAVA_KEY` - key alias for the Java Keystore

Complete the build and you should have an `app-release.aab` file that you can
upload to the Google Play console.

### Fastlane

Fastlane is a tool to automate uploading builds to Google Play. It requires some setup that
is [detailed here](https://docs.fastlane.tools/getting-started/android/setup/), or refer
to [the official Google documentation](https://developers.google.com/android-publisher/getting_started/).

Fastlane is written in Ruby and so running it requires Ruby and that you install
a bunch of 'Gems'.   If you want to do this locally to test then one option is
to use [rvm](https://rvm.io/) to manage Ruby versions and Gem installs, another is
just to install Ruby globally.   I found that installing Ruby globally with
`brew` (MacOS) was easiest and then used a config setting to get gems installed
into my home directory rather than globally (`bundle config set --local path /Users/Steve/.gem/ruby/3.3.0`).  You would then run `bundle install` from inside the `app/android`
directory to get fastlane etc installed.

#### Google Cloud Project

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

Here are the initial setup steps, others are described in more detail below.

- __Checkout__: Checkout the latest version of the code.
- __Cache Node Modules__: Sets up and/or restores a cache of node modules to speed up npm install
- __Configure Turborepo Remote Cache__
Configures a turborepo build cache so that previous builds can be used if there
are no changes.
- __Install `jq`__: A command line JSON processor
- __Declare Some Variables__: Set up `sha_short`, a short hash of the latest git commit and `app_version` which pulls the app version string from `app/package.json` using `jq`.
- __Create Version String__: Make a version string for the app based on the two variables from the last step
Version is eg. `1.0.0-android-#AAAFFFEEE`
- __Cache Gradle Packages__:
Set up and/or restore a cache of gradle packages for the app build
- __Use Node.js $version__
Selects the version of Node to use, currently version 20 (from matrix setting above)
- __Set up adopt JDK 1.17__:
Get the right Java version for the build
- __Set up ruby env__:
Ruby is used for running `fastlane` to automate the upload to the app store.
- __Decode Service Account Key JSON File__:
Decode the `GPLAY_SERVICE_ACCOUNT_KEY_JSON` secret that contains a base64 encoded
version of the Google Cloud Service Account key which you created earlier.  Resulting file will be used by `fastlane` later as `ANDROID_JSON_KEY_FILE`.
- __Decode Keystore File__:
Decode the `KEYSTORE_FILE` secret that contains the base64 encoded content of the
key store. (How do we make this?)
- __Setup Android SDK__:
Runs the action to make the SDK available to the build.

### Building Webapp

This is the standard build step with the environment settings copied in from
Github variables or secrets and in some cases hard coded for production build
values.

Runs `npm run build` and then copies the build to android (`npm run app-update android`)

### Run Fastlane

Then runs `bundle install` to install ruby gems for fastlane.

Then runs `fastlane` to build and deploy the application. Fastlane is driven by
two files: Appfile and Fastfile. Appfile declares the JSON service account key
which gives us access
to the Google Play API and defines a package name which determines which app
we will be updating.  Both of these come from the environment in our

```ruby
json_key_file(ENV["ANDROID_JSON_KEY_FILE"])
package_name(ENV["ANDROID_APP_ID"])

for_platform :android do
  for_lane :deploy_fieldmark do
    package_name(ENV["ANDROID_APP_ID"])
  end
end
```

Fastlane actions are defined by a `lane` in the [Fastfile](../../app/android/fastlane/Fastfile):

```ruby
   lane :deploy_fieldmark do
      gradle(task: "clean")
      sh("echo", VERSION_NAME)
      gradle(task: "bundle",
            build_type: "Release",
            properties: {
               "versionCode" => VERSION,
               "versionName" => VERSION_NAME,
               "android.injected.signing.store.file" => JAVA_KEYSTORE,
               "android.injected.signing.store.password" => JAVA_KEYSTORE_PASSWORD,
               "android.injected.signing.key.alias" => JAVA_KEY,
               "android.injected.signing.key.password" => JAVA_KEY_PASSWORD,           
            }
            )
      upload_to_play_store(json_key: ENV["ANDROID_JSON_KEY_FILE"],
                           track: ENV["ANDROID_DEPLOY_TRACK"],
                           release_status: RELEASE_STATUS,
                           skip_upload_metadata: true,
                           skip_upload_images: true,
                           skip_upload_screenshots: true
                        )
   end
```

This is basically two tasks, a gradle build followed by uploading to the app store.  
We configure the build with a few environment variables, notably the version/version
name and the means to sign the generated application bundle.  The upload is
configured with the JSON Service Key file and the track to deploy to. The
package name has been configured in the Appfile.

Note that the upload here does not upload metadata/images/screenshots. It is
possible to automate these uploads using fastlane but for now we just upload
those manually to the Play Console.  There was a step to generate a changelog
that I've removed for now since the result was not used.

## Variables and Secrets for deployment

The following variables and secrets are set in the the Github repository
where these workflows will run.  

- `vars.NIGHTLY_CONDUCTOR_URL` - URL setting for test build
- `vars.PRODUCTION_CONDUCTOR_URL` - URL setting for production build
- `vars.TURBO_TEAM` - Turbo cache team name for authentication
- `vars.TURBO_API_URL` - Turbo cache URL
- `vars.ANDROID_APP_ID` - the id of the app on the app store, eg. 'au.edu.faims.fieldmark', needs to be unique per deployment
= `vars.ANDROID_RELEASE_STATUS` - the release status, normally 'completed' but for a draft (not yet reviewed) app this could be 'draft'

Secrets will not be visible once added so we need to keep copies somewhere safe.

- `secrets.TURBO_TOKEN` - authentication token for the turbo cache
- `secrets.GPLAY_SERVICE_ACCOUNT_KEY_JSON` - bases64 encoded version of service account key, the workflow decodes this and sets `ANDROID_JSON_KEY_FILE` to point to it
- `secrets.BUGSNAG_KEY`
- `secrets.KEYSTORE_FILE` - java key store file, base64 encoded
- `secrets.JAVA_KEY_PASSWORD` - password for the Java keystore
- `secrets.JAVA_KEY` - key alias for the Java Keystore
