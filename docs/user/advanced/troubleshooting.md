(advanced/troubleshooting)=
# Troubleshooting

Resolving common issues with and unexpected behaviour in the Fieldmark™ app

:::{danger}
This guide contains instructions for troubleshooting steps that could result in data loss. Please follow the steps with care, back up as a precaution and seek  assistance if you are unsure.
:::

## How to report a bug

Go to the top left menu, then About Build. Report the directory server and commit version as part of your bug report. Your bug report should answer the following questions:

1. What were you trying to do?
2. What were you expecting to happen?
3. What is the smallest series of steps that will cause this bug to happen?
4. What device are you using, what version of the operating system and/or browser are you running?
5. When was the last time you backed up your data?
6. When was the last time you synced successfully? (A successful sync requires you to personally validate your data is present on another Fieldmark™ app/browser)
7. Does this bug happen on a different device if you follow the instructions in step 3?

See [Reporting a Bug](advanced/bug-report)

## How to attempt a backup

Go to the top left menu, then About Build. If you're on the browser choose "Download Local Database Contents". If you're on a mobile device choose "Share local database contents."

:::{danger}
Our current backup implementation fails with database sizes of more than 500 MiB. Back up early and often. When the backup fails (you push the button and nothing happens), ensure you have synced your records by validating your changes on a different computer and wipe and reset.
:::

To attempt data restoration, contact info@fieldmark.au. A support contract is required. We recommend projects going out into the field rehearse data recovery with us before they depart for the field.

## How to wipe your system

:::{danger}
Wipe and reset will **DELETE ALL YOUR DATA** along with design edits and settings.  **DO NOT WIPE** until you have synced your records and checked for those records on a different computer or device.
:::

Go to the top-left menu, about, then click `wipe and reset everything`. This button will **wipe all data** inside Fieldmark™. There is no recovery possible once you have pushed this button if you have any drafts or unsynced data. Do not push this button unless you are prepared to lose data, or are instructed by Fieldmark support and are prepared to lose data.
