# 📦 Deploying and setting up iOS App to Apple App Store via GitHub Actions + Fastlane

This document explains in full detail how to deploy an iOS app to the **Apple App Store** using GitHub Actions and Fastlane. It includes prerequisites, setup instructions, permission roles in App Store Connect, Fastlane Match usage, environment settings, and per-org deployment structure.

## 🛠️ Table of Contents

1. [Prerequisites](#️-prerequisites)
2. [Apple App Store Roles & Permissions](#-apple-app-store-connect-roles--permissions)
3. [Setting up Fastlane Match](#-setting-up-fastlane-match)
4. [GitHub Workflow Structure](#-github-workflow-structure)
5. [Environment Configuration](#-environment-configuration)
6. [Appfile & Fastfile Logic](#-appfile--fastfile-logic)
7. [Multi-Org Deployment Setup](#-multi-org-deployment-setup-example-csiro--fieldmark)
8. [Best Practices & Notes](#-best-practices--notes)

## Prerequisites

Create an account on the Apple Developer Portal.

- Active **Apple Developer Program** membership ($99/year)
  This will be handled by your account admin/organisation admin.
- Access to [App Store Connect](https://appstoreconnect.apple.com)

- To create a new app. First register a new App ID for your app (eg. au.edu.faims.bss); do
  this on your Apple Developer account (under Certificates, Identifiers & Profiles). In the App page on App Store Connect click on the + button and select "New App", fill in
  the details and select the App ID you created above as the Bundle ID. SKU can be any
  memorable name, unique among your apps. Keep a record of the APP ID for future reference.

- Have access to or setup a private GitHub repository to store signing certificates via Fastlane Match

- ## Very Important ## - You would need a Local or CI Mac system (Xcode, Fastlane installed)

Complete the entry of data about your app, fill out the App Information, upload screenshots.

## Apple App Store Connect Roles & Permissions

App Store Connect assigns **roles** to users which control what actions they can take.

| Role                                              | Permissions                                                                                     |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Admin**                                         | Full access including **certificates, app creation, uploading builds**, managing users          |
| **App Manager**                                   | Can **upload builds, submit for review**, manage app info, but **cannot manage users** or certs |
| **Developer**                                     | Can upload builds **via Xcode/Fastlane**, but **cannot submit to App Review**                   |
| **Marketing**                                     | View-only access to analytics and reports                                                       |
| **Access to Certificates (via Apple Dev Portal)** | Only Admins can access provisioning profiles & certificates                                     |

### Example

To generate certificates using `fastlane match`, your Apple account **must be an Admin** in the Developer Portal.

To **submit apps to review**, the GitHub Actions user (via API key) must be at least an **App Manager**.

## Workflows

There are two workflows, one for the nightly build and one for the production build. Both
are basically the same and use Fastlane to automate the deployment process. The
only difference between these is that the TestFlight build is conditional on
changes to the repository and that it uses a different Fastlane configuration
to push to the TestFlight deployment.

Similar to the Android workflows, the workflows basically just build the
React app adn then use Fastlane to compile the iOS app and upload it to the
App Store.

## Setting Up Fastlane Match

[Fastlane match](https://docs.fastlane.tools/actions/match/) is used to store signing keys
for the App Store. It requires that we create a new **private** repository on Github
to store the signing certificates. Create this repository and set the value of
MATCH_GIT_URL in the configuration environment.

To generate the secrets we need to run `fastlane match`. This requires a temporary file
`Matchfile` to be created, this can be done outside of the project repository. First,
create the Matchfile with:

```shell
bundle exec fastlane match init
```

This will prompt you for the URL of your new private repository and will generate a file `Matchfile`.
Next we run the following command to initialise the signing keys for app store deployment:

```shell
bundle exec fastlane match appstore
```

This will ask you for a passphrase to encrypt the certificates which will be the
value of `MATCH_PASSWORD` in your configuration.

Once this is complete you can remove the `Matchfile` that was created.

More Steps:

### 1. Install Fastlane on a Mac

```bash
brew install fastlane
```

### 2. Create Private Repo

Make a new private GitHub repo (e.g., `your-org-ios-certifications`). Add your team members.

### 3. Initialize Match

```bash
fastlane match init
```

Enter the cert repo URL when prompted. It creates a `Matchfile`.

### 4. Generate App Store Certs

```bash
fastlane match appstore
```

You'll be prompted to enter a **password** to encrypt the certs. Save this as `MATCH_PASSWORD`.

### 5. Upload to GitHub

Certificates and provisioning profiles will be pushed to your **private repo**.

## 🧬 GitHub Workflow Structure

Each org (CSIRO, Fieldmark) has its **own deployment workflow** in `.github/workflows/`.

```text
.github/workflows/
├── fieldmark-deploy.yml
└── csiro-deploy.yml
```

### Example CSIRO Workflow Trigger

```yaml
on:
  workflow_dispatch:

jobs:
  build-deploy-ios:
    name: Build and Deploy iOS App
    runs-on: macos-latest
    env:
      MATCH_PASSWORD: ${{ secrets.CSIRO_MATCH_PASSWORD }}
      MATCH_GIT_URL: https://github.com/ranisa-gupta16/csiro-ios-certifications
      APPLE_KEY_ID: ${{ secrets.CSIRO_APPLE_KEY_ID }}
      APPLE_ISSUER_ID: ${{ secrets.CSIRO_APPLE_ISSUER_ID }}
      APPLE_KEY_CONTENT: ${{ secrets.CSIRO_APPLE_KEY_CONTENT }}
      APP_STORE_CONNECT_TEAM_ID: ${{ secrets.CSIRO_TEAM_ID }}
    steps:
      - name: Checkout
        uses: actions/checkout@v3
      - name: Install dependencies
        run: bundle install
      - name: Build and Upload
        run: bundle exec fastlane ios appstore
```

## Settings

The following settings are used in the workflows and need to be set
up as either secrets or variables in the Github repository.

## 📄 Appfile & Fastfile Logic

### Appfile

Can be overridden in CI via ENV variables. If not, it should define:

```ruby
app_identifier("au.csiro.bss")
apple_id("csiro-developer@csiro.au")
team_id("ABCDE12345")
```

### Secrets

`DEVELOPER_PORTAL_TEAM_ID` - Developer Portal team identifier. Find this at
<https://developer.apple.com/account>, look for Membership Details. This is an
alphanumeric identifier.

`APP_STORE_CONNECT_TEAM_ID` - App Store Connect team identifier. May be the same
as the Developer Portal team identifier, find this via App Store Connect
by looking at your personal account which will list the id of your team.

`FASTLANE_APPLE_ID` - Apple ID used by Fastlane to publish the app.

`GIT_AUTHORIZATION` - A Github personal access token with access to the
Fastlane certificates repository.

`APPLE_KEY_ID` - The key id from the 'Team Key' in App Store Connect. Look under Users and Access > Integrations > App Store Connect API for Team Keys.
`APPLE_ISSUER_ID` - the Issuer ID from the 'Team Key' in App Store Connect. Look under Users and Access > Integrations > App Store Connect API for Team Keys.
`APPLE_KEY_CONTENT` - Content of the key file (not encoded). You can only download this on creation of the key.

`BROWSERSTACK_USERNAME` - username on BrowserStack (for app testing);
`BROWSERSTACK_ACCESS_KEY` - api access key for BrowserStack.

`MATCH_PASSWORD` - password used to encrypt certificates in fastlane match.

`MAP_SOURCE_KEY` - API key for map tiles

### Variables

These are not sensitive so can be variables:

`DEVELOPER_APP_ID`: numeric App identifier from App Store Connect. Go to the App
in App Store Connect and view 'App Information', look for "Apple Id" under
general information.

`APPLE_BUNDLE_IDENTIFIER`: bundle identifier for Apple build, this needs to be unique
in the app store, can be different to APP_ID (which is used for the app URL scheme)
`au.edu.faims.electronicfieldnotebook`.

TODO: make `APPLE_BUNDLE_IDENTIFIER` fully configurable in the build
process. Look at
the Fastlane `update_app_identifier` action which can do this
during the build. For now we will keep the Fieldmark id to the
one that's been in use so far but when we want a BSS release
we'll need it to be updated.

- `vars.ENABLE_RECORD_FILTERS` - enable 'filters' in the records table
- `vars.HEADING_APP_NAME` - The app name displayed in the app main page, defaults to APP_NAME
- `vars.MAP_SOURCE` - source for map tiles, 'maptiler' or 'osm'
- `vars.APP_PRIVACY_POLICY_URL` - URL for the app privacy policy link in the app footer
- `vars.SUPPORT_EMAIL` - Support email address displayed in the app
- `vars.APP_CONTACT_URL` - URL for the 'Contact' link in the app footer

## Note on Development Team

The setting `APP_STORE_CONNECT_TEAM_ID` is required in the build and must match
the identity of the team that generated the certificates used by `fastlane match`.
This team name is mentioned in the file `app/ios/App/App.xcodeproj/project.pbxproj`
but we've had problems with the build if we don't explicitly include the value
in that file. There is code in `Fastfile` to update it to the configured
value. We've not yet verified that this works.

It may be necessary to change the value of DEVELOPMENT_TEAM in the project file
if you want to deploy from a different team.
