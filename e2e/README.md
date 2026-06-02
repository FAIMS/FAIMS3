# FAIMS End to End Tests

This directory contains a set of end to end tests for the FAIMS3 system. These tests run in-browser and test a running version of the application that includes the api server, data collection app and web dashboard.

## Preparation

Before running these tests you should have a version of the applications running - usually in your local
development environment. Configure the application the way you want it to appear in the tests (eg.
theme). You should load a standard set of data so that the tests can work from a known state.

These instructions assume that you have a working local development environment.
See [the main README](../README.md) for details of how to set that up.

In the project root directory, clear the couchdb database:

```bash
./scripts/clearCouchDb.sh
```

Next, in the `api` directory, run the script to create the standard test dataset:

```bash
pnpm seed-test-dataset
```

This will output some configuration variables, by default:

```bash
TEST_OPERATIONS_ADMIN_USERNAME=seed-admin@faims.test
TEST_OPERATIONS_ADMIN_PASSWORD=TestPassword123!
TEST_MANAGER_BLUE_USERNAME=seed-manager-blue@faims.test
TEST_MANAGER_BLUE_PASSWORD=TestPassword123!
TEST_MANAGER_CROSS_USERNAME=seed-manager-cross@faims.test
TEST_MANAGER_CROSS_PASSWORD=TestPassword123!
TEST_MEMBER_BOTH_USERNAME=seed-member-both@faims.test
TEST_MEMBER_BOTH_PASSWORD=TestPassword123!
TEST_RED_MEMBER_CREATOR_USERNAME=seed-red-member-creator@faims.test
TEST_RED_MEMBER_CREATOR_PASSWORD=TestPassword123!
TEST_USER_USERNAME=seed-user@faims.test
TEST_USER_PASSWORD=TestPassword123!
TEST_PROJECT_CONTRIBUTOR_USERNAME=seed-project-contributor@faims.test
TEST_PROJECT_CONTRIBUTOR_PASSWORD=TestPassword123!
TEST_PROJECT_GUEST_USERNAME=seed-project-guest@faims.test
TEST_PROJECT_GUEST_PASSWORD=TestPassword123!
```

Copy these into the .env file in the `e2e` directory - if you use the default settings the values
in `.env.dist` will not need updating.

Next, ensure all of the component services are running. One way to do this is
with the `localdev.sh` script from the main project folder:

```bash
./localdev.sh --all
```

## Running Tests

A number of test configurations are available in the `e2e/package.json` file. Two main configurations are for using a local browser and for headless operation. The headless options are suitable for running in batch mode in CI where no screen is available.

The different configurations run the tests with different settings for the `VIEWPORT` environment variable which controls the size of the browser window. `pnpm test:e2e:mobile` will run the tests on a mobile sized window while `pnpm test:e2e:desktop` will run on a larger window. `pnpm test:headless:e2e:mobile` would be the equivalent for a headless setup.

Many of the tests write screenshots. These are intended to be used in the user documentation. The
environment variable `SCREENSHOT_DIR` determines where these will be written. The output is written
in the same directory structure as is used in the screenshots folder in the user documentation.
