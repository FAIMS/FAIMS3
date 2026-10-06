# Backup and recovery

Written for procurement, ethics and information technology reviewers assessing
{{FAIMS}}® for an institution. It describes what is backed up, how long it is
kept, and how the service is recovered. It is not a developer guide.

It describes the standard hosted service, which is what a Team or Individual
subscription receives. A custom enterprise deployment can differ in its backup
schedule, retention, and location. Where it does, the agreement covering that
deployment states what applies.

## What is backed up

The database holding your records, your media, and your {{notebook}} definitions.
That is the whole state of your workspace: everything you and your team have
entered, and the forms you entered it into.

Server software, operating systems and configuration are deliberately **not**
backed up. They are defined as code, held in version control, and rebuilt from
that code when needed. This is explained under "How recovery works" below,
because it changes what a backup has to contain.

## How often, and how long it is kept

Backups run **daily**. Each daily backup is kept for **7 days**, one backup a
week for **4 weeks**, and one backup a month for **12 months**. Data can be
restored as it stood on any day in the past week, at weekly points over the past
month, and at monthly points over the past year.

A record created and deleted between two retained backups is in none of them.

Each backup run reports its result to the operations team automatically, so a
failed backup is seen the day it happens.

Two different promises are involved here, and they are worth separating.

**How far back data can be recovered** is a recovery promise: a year, at the
points above. When a contract ends, the workspace itself remains available for a
further 30 days so that the institution can export before anything is removed.

**How long data could still exist** is a privacy promise. **No copy of
institutional data is kept beyond 12 months after deletion.** That period runs
from deletion, not from the end of a contract, so the outside limit at the end
of a contract is about 13 months. No backups or snapshots are taken outside the
automated schedule. If one is ever needed, for example before an upgrade, it is
deleted within 30 days.

The reason for a year is worth stating, because it sounds long in isolation.
{{FAIMS}} holds research data, which contains personal information only
incidentally and usually very little of it, and researchers find their mistakes
late. A season of fieldwork cannot be collected again. A year of recoverable
history is worth more to the people whose data it is than an early deletion
would be, and it is a judgement an institutional ethics or risk reviewer is used
to seeing made this way. Where it does not suit a project, a shorter window can
be set for it.

A custom enterprise deployment may keep backups for a different period. Its
retention is stated in the agreement covering it.

In summary:

|                                      | Can be restored                                             | Gone by                  |
| ------------------------------------ | ----------------------------------------------------------- | ------------------------ |
| Your workspace after a contract ends | 30 days, by export                                          | 30 days                  |
| Backups                              | Daily for 7 days, weekly for 4 weeks, monthly for 12 months | 12 months after deletion |

## How recovery works

Recovery is a rebuild and a restore, not the restoration of a disk image.

The servers, their operating system, the application and its configuration are
described in code. Recovery redeploys that code to produce a clean environment,
then restores the database backup into it. The result is a known-good system
carrying your data.

This is a deliberate choice and worth understanding if you are assessing the
service. Restoring a disk image also restores whatever was wrong with the
machine at the moment it was captured, including a misconfiguration or an
intruder's foothold. A rebuild cannot carry either forward.

It also means the answer to "do your backups contain everything needed for
recovery" is yes, whilst the backups themselves contain only data. Both halves,
the code and the data, are held and versioned.

## Where your data is held

The standard hosted service runs in an **Australian data centre**. That is the
default because research data belongs onshore unless an institution decides otherwise, and it is chosen with
the Australian Privacy Principles in mind.

Other locations are possible for a custom enterprise deployment where a project
requires them, and are scoped in the agreement rather than assumed.

## Getting your own copy

You do not need to rely on any of the above to hold your own copy. Export is
available throughout the life of a {{notebook}}, in the formats {{FAIMS}} supports,
and it does not require Electronic Field {{Notebooks}} to be involved. Exporting
regularly into your institution's own systems is the expected workflow, and it
is the most reliable protection available to you.

Where an institution wants a copy of the underlying backups rather than an
export, ask and it can be arranged.
