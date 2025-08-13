# Roles and Permissions

{{FAIMS}} uses a role-based permissions system to control access to different
functions and data.  This page outlines the different roles that are
available and what they are allowed to do.

## Resources

The permissions model centres around access to _resources_ in the system. These
resources are: _teams_, _user accounts_, _templates_ and _{{notebooks}}_ and the
_system_ as a whole.  A role can be given permission to read, update or create
any of these resources.  So, for example, the system administrator can create
teams and assign a team administrator who can then create users and {{notebooks}}
within that team.

There is a _General Administrator_ role that is allowed to do anything in the system,
this is reserved for overall system management.  

All users in the system are able to:

- list {{notebooks}} that they have access to
- list templates that they have access to
- create and revoke API access tokens

### Team Roles

Team roles relate to the management of teams, adding users and managing the templates
and {{notebooks}} in the team.

| Permission | Member | Manager | Administrator |
|:-----------|:------:|:-------:|:-------------:|
| Read, write and edit records in any {{notebook}} owned by the team | yes | yes | yes |
| View any templates owned by the team | yes | yes | yes |
| Update the details of the team (name and description) |   | yes | yes |
| Add or remove members to a team |   | yes | yes |
| Create templates and {{notebooks}} within the team |   | yes | yes |
| Create and manage member invites to the team |   | yes | yes |
| Act as {{notebook}} manager for any {{notebook}} owned by the team |   | yes | yes |
| Add or remove managers to the team |   |  | yes |
| Act as {{notebook}} administrator for any {{notebook}} owned by the team |   |  | yes |
| Act as template administrator for any template owned by the team |   |  | yes |

### Template Roles

Template roles give a user permission to work on a particular template.

| Permission | Guest  | Administrator |
|:-----------|:------:|:-------------:|
| View the template | yes | yes |
| update all details of a template |   | yes |
| archive a template so it is no longer available |  | yes |

### {{Notebook}} Roles

{{Notebook}} roles relate to actions on a particular {{notebook}}.

| Permission | Guest  | Contributor | Manager | Administrator |
|:-----------|:------:|:-----------:|:-------:|:-------------:|
| Activate the {{notebook}} in the app | yes | yes | yes | yes |
| Create records in the {{notebook}} | yes | yes | yes | yes |
| View, edit and mark as deleted any records that they have created | yes | yes | yes | yes |
| read, edit and delete records from other users of this {{notebook}} in the app |  | yes | yes | yes |
| can update the {{notebook}} metadata and design |  |  | yes | yes |
| can change the status of the {{notebook}} to _closed_ |  |  | yes | yes |
| can assign a {{notebook}} to a different team |  |  | yes | yes |
| can export data from the {{notebook}} in various formats |  |  | yes | yes |
| can create invites for the {{notebook}} and add or remove new guests, contributors and managers |  |  | yes | yes |
| add or remove other administrators to the {{notebook}} |  |  |  | yes |
| delete the notebook (operation not currently supported) |  |  |  | yes |
