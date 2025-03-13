# Deploying the App on the Apple App Store

This document describes the deployment of the app on the Apple App store via the
Github workflows in this repository.

## Pre-requisites

Create an account on the Apple Developer Portal.

## Workflows

There are two workflows, one for the nightly build and one for the production build. Both
are basically the same and use Fastlane to automate the deployment process.  The
only difference between these is that the TestFlight build is conditional on
changes to the repository and that it uses a different Fastlane configuration
to push to the TestFlight deployment.

Similar to the Android workflows, the workflows basically just build the
React app adn then use Fastlane to compile the iOS app and upload it to the
App Store.

## Settings

The following settings are used in the workflows and need to be set
up as either secrets or variables in the Github repository.

### Secrets

`DEVELOPER_PORTAL_TEAM_ID` - Developer Portal team identifier. Find this at
<https://developer.apple.com/account>, look for Membership Details. This is an
alphanumeric identifier.

`APP_STORE_CONNECT_TEAM_ID` - App Store Connect team identifier.  May be the same
as the  Developer Portal team identifier, find this via App Store Connect
by looking at your personal account which will list the id of your team.

`FASTLANE_APPLE_ID` - Apple ID used by Fastlane to publish the app.

`GIT_AUTHORIZATION` - A Github personal access token with access to the
Fastlane secrets repository.

`APPLE_KEY_ID` - The key id from the 'Team Key' in App Store Connect.  Look under Users and Access > Integrations > App Store Connect API for Team Keys.
`APPLE_ISSUER_ID` - the Issuer ID from the 'Team Key' in App Store Connect.  Look under Users and Access > Integrations > App Store Connect API for Team Keys.
`APPLE_KEY_CONTENT` - base64 encoded content of the key file. You can only download this on creation of the key.

`BROWSERSTACK_USERNAME` - username on BrowserStack (for app testing);
'BROWSERSTACK_ACCESS_KEY` - api access key for BrowserStack.

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
