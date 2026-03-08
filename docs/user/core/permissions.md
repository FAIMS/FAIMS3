# Roles and Permissions

{{FAIMS}} uses a role-based permissions system to control access to different
functions and data.  This page outlines the different roles that are
available and what they are allowed to do.

## Resources

The permissions model centres around access to *resources* in the system. These
resources are: *teams*, *user accounts*, *templates* and *{{notebooks}}* and the
*system* as a whole.  A role can be given permission to read, update or create
any of these resources.  So, for example, the system administrator can create
teams and assign a team administrator who can then create users and {{notebooks}}
within that team.

All users in the system are able to:

- list {{notebooks}} that they have access to
- list templates that they have access to
- create and revoke API access tokens

## Global Roles

Global roles apply to the system as a whole and are reserved for
administrative users.

The *Super User* role has permission to do anything in the system
and should only be used for emergency interventions. Every deployment has a
default user `admin` with this role configured for local login.  Other users
can be given this role if necessary but since it has access to user data,
it should be used with caution.

The *Operations Administrator* role is intended for IT staff managing a deployment.
It has permissions to manage teams and users but will not be able to
see any user data.

### Team Roles

Team roles relate to the management of teams, adding users and managing the templates
and {{notebooks}} in the team.

| Permission | Member | Member (Creator) | Manager | Administrator |
|:-----------|:------:|:-------:|:-------:|:-------------:|
| Read, write and edit records in any {{notebook}} owned by the team | ✅ | ❌ | ✅ | ✅ |
| View any templates owned by the team | ✅ | ❌ | ✅ | ✅ |
| Update the details of the team (name and description) | ❌ | ❌ |✅ | ✅ |
| Add or remove members to a team | ❌ | ❌ | ✅ | ✅ |
| Create templates and {{notebooks}} within the team | ❌ | ✅ | ✅ | ✅ |
| Create and manage member invites to the team | ❌ | ❌ | ✅ | ✅ |
| Act as {{notebook}} manager for any {{notebook}} owned by the team | ❌ | ❌ | ✅ | ✅ |
| Add or remove managers to the team | ❌ | ❌ | ❌ | ✅ |
| Act as {{notebook}} administrator for any {{notebook}} owned by the team | ❌ | ❌ | ❌ | ✅ |
| Act as template administrator for any template owned by the team | ❌ | ❌ | ❌ | ✅ |

> ⚠️ **Note**: *Team Member (Creator)* can create {{notebooks}} but does NOT automatically get access to existing team {{notebooks}}. This is by design for teaching environments where students create isolated {{notebooks}}.  They would become *{{Notebook}} Administrator* for any {{notebooks}} that they create.

### Template Roles

Template roles give a user permission to work on a particular template.

| Permission | Guest  | Administrator |
|:-----------|:------:|:-------------:|
| View the template | ✅ | ✅ |
| update all details of a template | ❌ | ✅ |
| archive a template so it is no longer available | ❌ | ✅ |

> 💡 **Note**: Template roles are primarily managed through team membership. Team Administrators act as template administrators for team templates.

### {{Notebook}} Roles

{{Notebook}} roles relate to actions on a particular {{notebook}}.

| Permission | Guest  | Contributor | Manager | Administrator |
|:-----------|:------:|:-----------:|:-------:|:-------------:|
| Activate the {{notebook}} in the app | ✅ | ✅ | ✅ | ✅ |
| Create records in the {{notebook}} | ✅ | ✅ | ✅ | ✅ |
| View, edit and mark as deleted any records that they have created | ✅ | ✅ | ✅ | ✅ |
| read, edit and delete records from other users of this {{notebook}} in the app |  | ✅ | ✅ | ✅ |
| can update the {{notebook}} metadata and design | ❌ | ❌ | ✅ | ✅ |
| can change the status of the {{notebook}} to *closed* | ❌ | ❌ | ✅ | ✅ |
| can assign a {{notebook}} to a different team | ❌ | ❌ | ✅ | ✅ |
| can export data from the {{notebook}} in various formats | ❌ | ❌ | ✅ | ✅ |
| can create invites for the {{notebook}} and add or remove new guests, contributors and managers | ❌ | ❌ | ✅ | ✅ |
| add or remove other administrators to the {{notebook}} | ❌ | ❌ | ❌ | ✅ |
| delete the notebook (operation not currently supported) | ❌ | ❌ | ❌ | ✅ |
