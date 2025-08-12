# Deploying the App on the Google Play Store

Here we document the process of deployment of the Android app on the Play Store.
Based on the example given in [this Runway blog post](https://www.runway.team/blog/ci-cd-pipeline-android-app-fastlane-github-actions).

## Pre-requisites

### Create Google Play App

The automated process below can only work once we have created an app on the
Google Play console and uploaded a first version app bundle. This means we need
to do a local build, sign it with an _upload key_ and upload it to the
Google Play console manually.

Sign in to the Google Play console and create a new app. Fill in the required
details following the workflow prompts.

#### Steps:

1. Go to [Google Play Console](https://play.google.com/console/) and sign in with your developer account.
2. Click **Create App**, fill in:
   - App Name
   - Default Language
   - App or Game
   - Free or Paid
   - Declarations
3. After creation, complete mandatory sections:
   - App access, content ratings, target audience
   - Privacy policy URL
   - App category and contact details
   - Store listing and assets (icon, screenshots, etc.)

#### Build the App and Sync Android Project:

```bash
npm run build
cd app
npx cap sync android
npx cap open android
```

If working from WSL, you must open the generated `android` folder using Android Studio installed on Windows.

#### Setting up Android Studio (if not installed):

1. Download from [Android Studio](https://developer.android.com/studio)
2. Choose **Standard installation** during setup.
3. Open project: Navigate to `\wsl$\Ubuntu\home\<user>\your-project\app\android`
4. Trust and open project → Let Gradle sync fully

## Create and Configure Signing Keystore

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
You will later upload the `.aab` signed with this key and store this info as secrets in GitHub.

## Generate Signed AAB (First Manual Upload)

In Android Studio:

1. Go to **Build > Generate Signed Bundle / APK**
2. Select **Android App Bundle**, click **Next**
3. Choose or create new keystore using details above
4. Set Build Type to `release`, click **Finish**

Find your `.aab` file at:

```
app/android/app/release/app-release.aab
```

Upload this manually to the Play Console → Internal testing or production track.

### Fastlane

Fastlane automates Play Store deployments.

Fastlane is a tool to automate uploading builds to Google Play. It requires some setup that
is [detailed here](https://docs.fastlane.tools/getting-started/android/setup/), or refer
to [the official Google documentation](https://developers.google.com/android-publisher/getting_started/).

Fastlane is written in Ruby and so running it requires Ruby and that you install
a bunch of 'Gems'. If you want to do this locally to test then one option is
to use [rvm](https://rvm.io/) to manage Ruby versions and Gem installs, another is
just to install Ruby globally. I found that installing Ruby globally with
`brew` (MacOS) was easiest and then used a config setting to get gems installed
into my home directory rather than globally (`bundle config set --local path /Users/Steve/.gem/ruby/3.3.0`). You would then run `bundle install` from inside the `app/android`
directory to get fastlane etc installed.

### Install Fastlane Locally (if needed for testing):

```bash
sudo apt install ruby-full build-essential
sudo gem install fastlane -NV
```

Or use a Gemfile:

```ruby
source "https://rubygems.org"
gem "fastlane"
```

Then:

```bash
bundle install
```

## Google Cloud Project Setup

The workflow needs to be able to access the Google Play API and to do this we need
to set up a project on [Google Cloud](https://console.cloud.google.com/) and give it
permission to access the API. There are instructions on creating a Service Account Key on
the [Runway Documentation](https://docs.runway.team/integrations/app-stores/google-play-console#service-account-api-key-setup) page.

- You are creating a 'service account' which is effectively a proxy account that can
  access the API.
- You will give that account email permission to access the project
  on Google Play.
- When you create the service account you will download a file containing
  the private key for that account (eg. `fieldmark-app-deployment-c243ef36afb3.json`) / ('bushfiresurveyorsystemdeploy-63a8de61b6fb.json').
- We will use that below to configure the pipeline for app upload.

More details:

**To enable GitHub Actions + Fastlane deployments:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project
3. Enable API: "Google Play Android Developer API"
4. Go to **IAM & Admin > Service Accounts**
   - Create new service account
   - Grant access to **Editor** or **Google Play API role**
5. Create key (JSON format), e.g., `faims-service-account.json` or `bushfiresurveyorsystemdeploy-63a8de61b6fb.json`
6. Link the account in Play Console under **Setup > API Access**

## Encode and Store Secrets

To use secrets in GitHub Actions:

```bash
base64 my-release-key.keystore > keystore.txt
base64 faims-service-account.json > gplay_key.txt
or
base64 bushfiresurveyorsystemdeploy-63a8de61b6fb.json > gplay_key.txt
```

Copy and paste content of these `.txt` files into GitHub Secrets.

### Required GitHub Secrets:

- `KEYSTORE_FILE` - base64 of `.keystore` file
- `JAVA_KEY_PASSWORD` - keystore password
- `JAVA_KEY` - key alias
- `GPLAY_SERVICE_ACCOUNT_KEY_JSON` - base64 of service account json
- `TURBO_TOKEN`, `BUGSNAG_KEY`, `MAP_SOURCE_KEY` (as applicable)

## Please Note: This is Important :-)

You will create these when you do your first app bundle build via Android Studio and save it to a relevant
folder which you can access easily when required, you will need these details later for finalising the deployment.

## Workflow

Workflow `nightly-android-testbuild.yml` does a nightly build and deploy to the app store test stream.

Here are the initial setup steps, others are described in more detail below.

- **Checkout**: Checkout the latest version of the code.
- **Cache Node Modules**: Sets up and/or restores a cache of node modules to speed up npm install
- **Configure Turborepo Remote Cache**
  Configures a turborepo build cache so that previous builds can be used if there
  are no changes.
- **Install `jq`**: A command line JSON processor
- **Declare Some Variables**: Set up `sha_short`, a short hash of the latest git commit and `app_version` which pulls the app version string from `app/package.json` using `jq`.
- **Create Version String**: Make a version string for the app based on the two variables from the last step
  Version is eg. `1.0.0-android-#AAAFFFEEE`
- **Cache Gradle Packages**:
  Set up and/or restore a cache of gradle packages for the app build
- **Use Node.js $version**
  Selects the version of Node to use, currently version 20 (from matrix setting above)
- **Set up adopt JDK 1.17**:
  Get the right Java version for the build
- **Set up ruby env**:
  Ruby is used for running `fastlane` to automate the upload to the app store.
- **Decode Service Account Key JSON File**:
  Decode the `GPLAY_SERVICE_ACCOUNT_KEY_JSON` secret that contains a base64 encoded
  version of the Google Cloud Service Account key which you created earlier. Resulting file will be used by `fastlane` later as `ANDROID_JSON_KEY_FILE`.
- **Decode Keystore File**:
  Decode the `KEYSTORE_FILE` secret that contains the base64 encoded content of the
  key store. (How do we make this?)
- **Setup Android SDK**:
  Runs the action to make the SDK available to the build.

### Building Webapp

This is the standard build step with the environment settings copied in from
Github variables or secrets and in some cases hard coded for production build
values.

Runs `npm run build` and then copies the build to android (`npm run app-update android`)

### Run Fastlane

Ensure the following files exist in `app/android/fastlane/`:

Then runs `bundle install` to install ruby gems for fastlane.

Then runs `fastlane` to build and deploy the application. Fastlane is driven by
two files: Appfile and Fastfile. Appfile declares the JSON service account key
which gives us access
to the Google Play API and defines a package name which determines which app
we will be updating. Both of these come from the environment in our

```ruby
json_key_file(ENV["ANDROID_JSON_KEY_FILE"])
package_name(ENV["APP_ID"])

for_platform :android do
  for_lane :deploy_fieldmark do
    package_name(ENV["APP_ID"])
  end
end
```

Fastlane actions are defined by a `lane` in the [Fastfile](../../../../../app/android/fastlane/Fastfile):

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
name and the means to sign the generated application bundle. The upload is
configured with the JSON Service Key file and the track to deploy to. The
package name has been configured in the Appfile.

Note that the upload here does not upload metadata/images/screenshots. It is
possible to automate these uploads using fastlane but for now we just upload
those manually to the Play Console. There was a step to generate a changelog
that I've removed for now since the result was not used.

## Variables and Secrets for deployment

The following variables and secrets are set in the the Github repository
where these workflows will run.

- `vars.NIGHTLY_CONDUCTOR_URL` - URL setting for test build
- `vars.PRODUCTION_CONDUCTOR_URL` - URL setting for production build
- `vars.TURBO_TEAM` - Turbo cache team name for authentication
- `vars.TURBO_API_URL` - Turbo cache URL
- `vars.APP_ID` - the id of the app on the app store, eg. 'au.edu.faims.fieldmark', needs to be unique per deployment
- `vars.APP_NAME` - the app name that appears in various places
- `vars.ANDROID_RELEASE_STATUS` - the release status, normally 'completed' but for a draft (not yet reviewed) app this could be 'draft'
- `vars.ENABLE_RECORD_FILTERS` - enable 'filters' in the records table
- `vars.HEADING_APP_NAME` - The app name displayed in the app main page, defaults to APP_NAME
- `vars.MAP_SOURCE` - source for map tiles, 'maptiler' or 'osm'
- `vars.APP_PRIVACY_POLICY_URL` - URL for the app privacy policy link in the app footer
- `vars.SUPPORT_EMAIL` - Support email address displayed in the app
- `vars.APP_CONTACT_URL` - URL for the 'Contact' link in the app footer
- `vars.POUCH_BATCH_SIZE` - batch size for pouchdb replication, defaults to 10 to ensure reliable sync of large files

Secrets will not be visible once added so we need to keep copies somewhere safe.

- `secrets.TURBO_TOKEN` - authentication token for the turbo cache
- `secrets.GPLAY_SERVICE_ACCOUNT_KEY_JSON` - bases64 encoded version of service account key, the workflow decodes this and sets `ANDROID_JSON_KEY_FILE` to point to it
- `secrets.BUGSNAG_KEY`
- `secrets.KEYSTORE_FILE` - java key store file, base64 encoded
- `secrets.JAVA_KEY_PASSWORD` - password for the Java keystore
- `secrets.JAVA_KEY` - key alias for the Java Keystore
- `secrets.MAP_SOURCE_KEY` - API key for map tiles

---

## Summary

- ✅ Google Play Console App created
- ✅ Android Studio set up with WSL
- ✅ Manual `.aab` build and upload
- ✅ Service account and GCP configured
- ✅ GitHub secrets and variables prepared
- ✅ CI/CD pipeline using Fastlane & GitHub Actions

Future builds can now be deployed with one push via GitHub.

For iOS App Store deployment, please refer to the separate documentation.
