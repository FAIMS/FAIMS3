# On Device Backup of Data

There is an option in the app to share a backup dump of the on-device databases.  This is
intended as a safety measure. If a user is in the field and is concerned about data loss,
they can create a local backup of data that could be recovered at a future time.
We've also used this when devices have refused to sync data even though they have
a network connection (due to an unknown bug).

The backup option is available via the About Build screen in the app.  Clicking the
backup button initiates a database dump. The dump file is then available to
the device 'share' service which allows the user to save it as a local file or
send it to a service (GDrive, email etc).

## Dump Format

The dump format is JSONL with one JSON line per record, interspersed with header
lines.  At the start of each database dump the header line is as follows:

```JSON
{type: 'header', database: db.name, info: info}
```

Where `db.name` is the database name and `info` is the result of calling the `.info()`
method on the database.

Following lines are just raw documents from the database as single line JSON documents.
No ordering is done on the documents, they are just the result of calling `allDocs()` on
the database.

Note that all databases, including local databases such as drafts etc. are dumped. This
might be useful in diagnosing problems at some point.

## Restoring the Dump

The dump can only be restored on a server via a command line script:

```shell
npm run restore-backup fieldmark-backup-2025-06-19-1750363850254.jsonl
```

This would restore records from the backup file to all databases.  To limit the
databases restored to those matching the regular expression `mybackup.*`:

```shell
npm run restore-backup -- --pattern 'mybackup.*' fieldmark-backup-2025-06-19-1750363850254.jsonl
```

By default, existing records will not be overwritten when the backup is restored.
To overwrite existing records, add the `--force` flag to the command line:

```shell
npm run restore-backup -- --force fieldmark-backup-2025-06-19-1750363850254.jsonl
```
