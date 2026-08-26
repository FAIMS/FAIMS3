# 📦 Deploying and setting up iOS App to Apple App Store via GitHub Actions + Fastlane

This document explains in full detail how to deploy an iOS app to the
**Apple App Store** using GitHub Actions and Fastlane. It includes prerequisites,
setup instructions, permission roles in App Store Connect, Fastlane Match usage,
environment settings, and per-org deployment structure.

## Table of Contents

1. [Prerequisites](#️-prerequisites)
2. [Apple App Store Roles & Permissions](#-apple-app-store-connect-roles--permissions)
3. [Setting up Fastlane Match](#-setting-up-fastlane-match)
4. [GitHub Workflow Structure](#-github-workflow-structure)
5. [Environment Configuration](#-environment-configuration)
6. [Appfile & Fastfile Logic](#-appfile--fastfile-logic)
7. [Fastlane Lanes: Team vs Individual](#-fastlane-lanes-team-vs-individual)
8. [Multi-Org Deployment Setup](#-multi-org-deployment-setup-example-csiro--fieldmark)
9. [Submitting the App for Review (App Store Connect)](#-submitting-the-app-for-review-app-store-connect)
10. [Setting Up TestFlight for Internal Testing](#-setting-up-testflight-for-internal-testing)
11. [Best Practices & Notes](#-best-practices--notes)

## Prerequisites

Create an account on the Apple Developer Portal.

- Active **Apple Developer Program** membership ($99/year)
  This will be handled by your account admin/organisation admin.
- Access to [App Store Connect](https://appstoreconnect.apple.com)

- To create a new app. First register a new App ID for your app (eg. au.edu.faims.bss);
  do this on your Apple Developer account (under Certificates, Identifiers &
  Profiles). In the App page on App Store Connect click on the + button and
  select "New App", fill in the details and select the App ID you created above
  as the Bundle ID. SKU can be any memorable name, unique among your apps.
  Keep a record of the APP ID for future reference.

- Have access to or setup a private GitHub repository to store signing
  certificates via Fastlane Match

```{attention}
**Very Important** - You would need a Local or CI Mac system (Xcode, Fastlane
installed)
```

Complete the entry of data about your app, fill out the App Information, upload
screenshots.

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

To generate certificates using `fastlane match`, your Apple account **must be an
Admin** in the Developer Portal.

To **submit apps to review**, the GitHub Actions user (via API key) must be at
least an **App Manager**.

## Workflows

There are four App Store GitHub workflows. Each builds the React app, syncs
Capacitor/iOS, then runs a Fastlane lane to compile and upload:

| Workflow                                               | Fastlane lane                       | Destination             | API key type |
| ------------------------------------------------------ | ----------------------------------- | ----------------------- | ------------ |
| `.github/workflows/appstore-testflight.yml`            | `closed_beta_testflight`            | TestFlight              | Team         |
| `.github/workflows/appstore-deploy.yml`                | `production`                        | App Store (upload only) | Team         |
| `.github/workflows/appstore-testflight_individual.yml` | `closed_beta_testflight_individual` | TestFlight              | Individual   |
| `.github/workflows/appstore-deploy_individual.yml`     | `production_individual`             | App Store (upload only) | Individual   |

Team and Individual lanes share the same build/signing shape; they differ in
which App Store Connect API key they use and whether Match may renew certs.
See [Fastlane Lanes: Team vs Individual](#-fastlane-lanes-team-vs-individual).

## Setting Up Fastlane Match

[Fastlane match](https://docs.fastlane.tools/actions/match/) is used to store signing keys
for the App Store. It requires that we create a new **private** repository on Github
to store the signing certificates. Create this repository and set the value of
`vars.APP_CONFIG_REPO_SLUG` in GitHub Actions; workflows derive
`MATCH_GIT_URL` as `https://github.com/<slug>.git`.

To generate the secrets we need to run `fastlane match`. This requires a temporary file
`Matchfile` to be created, this can be done outside of the project repository. First,
create the Matchfile with:

```shell
bundle exec fastlane match init
```

This will prompt you for the URL of your new private repository and will
generate a file `Matchfile`.
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

### 4. Generate App Store Certs (signing your own distribution certificate)

**Note**: you can only run the below command if you are an admin in your
organisation, and you have not reached the limit of distribution certificates.
If your organisation has org scoped distribution certificates available, you
should use this instead. You will need to run fastlane match import which
prompts for

1. the non password protected .p12 file
2. the distribution.cer file
3. the provisioning profile.

These all need to be matched to the
same base certificate (e.g. public and private must match) and the
provisioning profile needs to be created _for_ that certificate.

The most reliable way to strip the password off a key is to 'double click'
open it in on a physical mac device, and add it to the login keychain.
You can then navigate to the certificate and export the key to
your system, leaving the password prompt empty. This is also
possible using `openssl` but you need to ensure you use the
legacy version of the signing algorithms since fastlane (or possibly Mac)
doesn't seem to properly support the latest LTS algorithms. The recommended
method is to use the Mac certificate manager since it always exports in a
suitable format.

If you would like to sign your own:

```bash
fastlane match appstore
```

You'll be prompted to enter a **password** to encrypt the certs. Save this as `MATCH_PASSWORD`.

### 5. Upload to GitHub

Certificates and provisioning profiles will be pushed to your **private repo**.

## 🧬 GitHub Workflow Structure

The current iOS deployment workflows are:

- `.github/workflows/appstore-testflight.yml`
- `.github/workflows/appstore-deploy.yml`
- `.github/workflows/appstore-testflight_individual.yml`
- `.github/workflows/appstore-deploy_individual.yml`

All four workflows follow the same config pattern:

1. Checkout this repository.
2. Checkout the private config repository from `vars.APP_CONFIG_REPO_SLUG`.
3. Read `build-config.json` and decrypt `build-secrets.enc.json`.
4. Generate env vars with `pnpm generate-build-config --platform ios`.
5. Run the relevant Fastlane lane.

## Settings

The iOS workflows now load build settings from a private deployment-config
repository instead of declaring most values as direct GitHub secrets/variables.

Each workflow does the following:

1. Checkout the config repository using `vars.APP_CONFIG_REPO_SLUG`.
2. Read environment-specific files:

- `mobile/<environment>/build-config.json`
- `mobile/<environment>/build-secrets.enc.json`

3. Decrypt `build-secrets.enc.json` in CI with `secrets.SOPS_AGE_KEY`.
4. Merge both JSON files and run `pnpm generate-build-config --platform ios`.
5. Export generated env vars to `GITHUB_ENV` for Fastlane.

For the full field mapping between JSON keys and generated env vars, see
[Mobile-Build-Config-Env-Mapping.md](Mobile-Build-Config-Env-Mapping.md).

### Bootstrap variables/secrets in GitHub

Only a small bootstrap set is required in GitHub Actions:

- `vars.APP_CONFIG_REPO_SLUG` - config repository slug in the form `owner/repo`
- `vars.MOBILE_CONFIG_BRANCH` - config branch (defaults to `main`)
- `vars.MOBILE_CONFIG_ENVIRONMENT` - environment folder under `mobile/`
- `secrets.GIT_AUTHORIZATION` - token with read access to the config repo
- `secrets.SOPS_AGE_KEY` - age private key for decrypting `build-secrets.enc.json`

The workflows derive:

- `MATCH_GIT_URL` from `APP_CONFIG_REPO_SLUG` as `https://github.com/<slug>.git`

This keeps one canonical repo setting for both config checkout and Fastlane Match.

Because the same repository is also used for Fastlane Match certificates/profiles,
follow the shared-repo safety guidance in
[Mobile-Build-Config-Env-Mapping.md](Mobile-Build-Config-Env-Mapping.md)
before changing anything outside `mobile/<environment>/`.

## Appfile & Fastfile Logic

### Appfile

Can be overridden in CI via env vars. If not, it should define:

```ruby
app_identifier("au.csiro.bss")
apple_id("csiro-developer@csiro.au")
team_id("ABCDE12345")
```

## Fastlane Lanes: Team vs Individual

Lanes live in `app/ios/App/fastlane/Fastfile`. Prefer the Team lanes when you
have a Team API key with Admin/App Manager access that can manage provisioning.
Use the Individual lanes when CI should authenticate with an Individual API
key and must not create, renew or revoke certificates. This is a safer workflow
for headless execution in a shared account environment where Team keys would
necessarily leak authentication against non target applications.

### Behaviour Differences

|                        | Team lanes (`closed_beta_testflight`, `production`)                                | Individual lanes (`*_individual`)                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| API key                | Team key: `APPLE_KEY_ID` + `APPLE_ISSUER_ID` + `APPLE_KEY_CONTENT`                 | Individual key: `APPLE_KEY_ID` + `APPLE_KEY_CONTENT` only (no issuer)                             |
| GitHub secrets         | `APPLE_KEY_ID`, `APPLE_ISSUER_ID`, `APPLE_KEY_CONTENT` (+ optional Apple ID / ASP) | `APPLE_INDIVIDUAL_KEY_ID`, `APPLE_INDIVIDUAL_KEY_CONTENT`                                         |
| Match                  | `readonly: false` — can fetch **and** create/renew App Store profiles via the API  | `readonly: true` — only clones existing certs/profiles from the Match git repo                    |
| Cert renewal           | Possible in CI (needs Team key + sufficient portal rights)                         | **Not** done in CI. Renew locally (or via a Team-key run) with Admin access, then commit to Match |
| Upload auth            | Team API key (+ Team workflows still pass Apple ID / ASP env vars)                 | Individual API key only (needs Fastlane ≥ 2.233 for altool uploads without Apple ID / ASP)        |
| TestFlight (`pilot`)   | Waits for build processing (`skip_waiting_for_build_processing: false`)            | Skips waiting (`true`) so CI stays non-interactive                                                |
| Production (`deliver`) | Uploads IPA; does not submit for review                                            | Same                                                                                              |

Both variants still need the shared Match and team identity values:
`MATCH_GIT_URL`, `MATCH_PASSWORD`, `GIT_AUTHORIZATION`,
`VITE_APPLE_BUNDLE_IDENTIFIER` / `APPLE_BUNDLE_IDENTIFIER`,
`DEVELOPER_APP_ID`, `DEVELOPER_PORTAL_TEAM_ID`, and
`APP_STORE_CONNECT_TEAM_ID` (`VITE_APP_STORE_CONNECT_TEAM_ID`).

### Creating an Individual API key

In App Store Connect → Users and Access → Integrations → App Store Connect API,
create an **Individual** key (not a Team key). Store the Key ID and `.p8`
contents as `APPLE_INDIVIDUAL_KEY_ID` and `APPLE_INDIVIDUAL_KEY_CONTENT`.
There is no Issuer ID for Individual keys.

### Practical Notes

- Individual lanes assume Match already has App Store certificates and a
  profile for `APPLE_BUNDLE_IDENTIFIER`. If Match is empty or expired, run
  `fastlane match appstore` (or a Team lane) outside the individual workflow
  first.
- If your Match profile name is not the default
  `match AppStore <bundle-id>`, set `PROVISIONING_PROFILE_SPECIFIER` to the
  exact name (both team and individual workflows honour this).
- Individual workflows are `workflow_dispatch` only (no nightly schedule).

## Note on Development Team

The setting `APP_STORE_CONNECT_TEAM_ID` is required in the build and must match
the identity of the team that generated the certificates used by `fastlane match`.
This team name is mentioned in the file `app/ios/App/App.xcodeproj/project.pbxproj`
but we've had problems with the build if we don't explicitly include the value
in that file. There is code in `Fastfile` to update it to the configured
value. We've not yet verified that this works.

It may be necessary to change the value of DEVELOPMENT_TEAM in the project file
if you want to deploy from a different team.

## Submitting the App for Review (App Store Connect)

Once your build is uploaded to App Store Connect via Fastlane or Xcode, follow
these steps to submit it for review:

### 🔹 Step-by-Step Guide

1. **Log in to [App Store Connect](https://appstoreconnect.apple.com)**

2. Go to **My Apps → [Your App] → iOS App Version** (e.g., 1.2.0)

3. Under the **Previews and Screenshots** section:
   - Upload at least 3 screenshots for the required devices (6.5” and 6.9” iPhones)
   - These will appear in your App Store listing.

4. Fill in:
   - **Promotional Text**
   - **Description** of the app (clear, concise, informative)
   - **Keywords** (comma-separated list)
   - **Support URL**, **Marketing URL**
   - **Copyright**
   - **Version Number** (must match the one in Xcode/Fastlane build)

5. Under **App Review Information**:
   - Provide **login credentials** if your app requires authentication
   - Add **Contact Name**, **Phone**, and **Email**

6. Under **App Privacy**:
   - Add your **Privacy Policy URL**
   - Choose **Data types** collected and **how they’re linked** (if at all)

7. Under **Build Section**:
   - Select the correct uploaded build (e.g., 202506160659)
   - Wait for the build to finish processing if it hasn’t yet

8. Under **App Store Version Release**:
   - Choose **Manual** or **Automatic** release after approval

9. **Submit for Review** at the top right

> Once submitted, Apple will begin the review process. Check back for status and feedback.

---

## Setting Up TestFlight for Internal Testing

TestFlight allows you to distribute test versions of your app to internal or
external testers.

### 🔹 Internal Testing Setup

1. Go to **App Store Connect → TestFlight**
2. Locate your uploaded build under the correct version (e.g., 1.2.0)
3. Click on the build and fill in:
   - **Test information** (what to test, known issues)
   - **Demo Account Info** if needed
4. Under **Internal Testing**, add users/groups (e.g., the BV group)
5. Enable toggle for the build → Status changes to **“Ready to Submit”**

> Internal testers must be added under App Store Connect → Users and Access → Internal Users

### 🔹 External Testing (Optional)

Requires Apple review. If needed:

1. Add a new **External Group**
2. Invite testers via email or TestFlight public link
3. Submit the build for external testing review
