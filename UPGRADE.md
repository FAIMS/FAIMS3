# Upgrades/Migrations

This document will describe the necessary steps to migrate existing deployments through versions of FAIMS.

# Upgrading from v1 to v1.1

## Upgrade summary

TBD - currently there are the following migrations needed.

## Pull request migrations

The following pull requests introduced breaking changes/migrations:

### [feat: admin forgot password reset workflow](https://github.com/FAIMS/FAIMS3/pull/1334)

**CouchDB migration**

This functionality will not work until you apply the following migration

- login as cluster admin to old conductor
- copy the bearer token
- update /api/.env with USER_TOKEN=<>
- setup npm env cd /api && npm i
- run the force init action npm run forceinitdb
- Try generating a code and make sure the workflow is functional.

**Deployment configuration**

Add the new `NEW_CONDUCTOR_URL` environment variable to the conductor/api build. This is already done in the aws-cdk IaC - however in existing deployments you may need to update your build configuration.

**Note** ensure this includes the https:// prefix!

This is a mandatory property and not including it will break the deployment.

### [feat: permissions, db, migrations overhaul](https://github.com/FAIMS/FAIMS3/pull/1380)

After deployment, the system will likely not function until the DB migration is run. To run the migration:

#### Setup your environment

- ensure your environment is updated/installed - I'd recommend a cleanse and then rebuild e.g. from `FAIMS3` root of repo `./scripts/purge.sh . && npm i && npx turbo build```
- setup a working local dev environment for `api`
- ensure the `.env` of your API is accurately configured for the target deployment (being careful of secrets here)

#### Bootstrap the migration service

Since the migration DB doesn't exist, the service has no way of knowing which version of the database is currently deployed.

In your local copy of the code, navigate to `library/data-model/src/data_storage/migrations/migrations.ts`.

Here you will need to edit the `DB_TARGET_VERSIONS` array to correctly specify `1` as the `defaultVersion` for all the DB types (assuming you have never migrated previously).

Before:

```typescript
export const DB_TARGET_VERSIONS: {
  [key in DATABASE_TYPE]: {defaultVersion: number; targetVersion: number};
} = {
  [DatabaseType.AUTH]: {defaultVersion: 1, targetVersion: 1},
  [DatabaseType.DATA]: {defaultVersion: 1, targetVersion: 1},
  [DatabaseType.DIRECTORY]: {defaultVersion: 1, targetVersion: 1},
  // invites v2
  [DatabaseType.INVITES]: {defaultVersion: 2, targetVersion: 2},
  [DatabaseType.METADATA]: {defaultVersion: 1, targetVersion: 1},
  // people v2
  [DatabaseType.PEOPLE]: {defaultVersion: 2, targetVersion: 2},
  [DatabaseType.PROJECTS]: {defaultVersion: 1, targetVersion: 1},
  [DatabaseType.TEMPLATES]: {defaultVersion: 1, targetVersion: 1},
};
```

After:

```typescript
export const DB_TARGET_VERSIONS: {
  [key in DATABASE_TYPE]: {defaultVersion: number; targetVersion: number};
} = {
  [DatabaseType.AUTH]: {defaultVersion: 1, targetVersion: 1},
  [DatabaseType.DATA]: {defaultVersion: 1, targetVersion: 1},
  [DatabaseType.DIRECTORY]: {defaultVersion: 1, targetVersion: 1},
  // CHANGED
  [DatabaseType.INVITES]: {defaultVersion: 1, targetVersion: 2},
  [DatabaseType.METADATA]: {defaultVersion: 1, targetVersion: 1},
  // CHANGED
  [DatabaseType.PEOPLE]: {defaultVersion: 1, targetVersion: 2},
  [DatabaseType.PROJECTS]: {defaultVersion: 1, targetVersion: 1},
  [DatabaseType.TEMPLATES]: {defaultVersion: 1, targetVersion: 1},
};
```

#### Run the migration command

- run the migration command `npm run migrate`

You should see output indicating that a) the invites DB has been migrated without errors b) the people DB has been migrated without errors. If either fails, login to your couchDB and interrogate the migration DB logs.

#### Force the migration to run 

If needed, you can login to your `/_utils` fauxton instance of CouchDB, then navigate to the Migrations DB. Find the migration document for the target DB, and update the `version` field to reflect what you want the migration system to think the database version is.
