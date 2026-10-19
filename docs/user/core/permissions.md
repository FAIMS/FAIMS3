# Roles and Permissions

{{FAIMS}} uses a role-based permissions system to control access to different
functions and data. This page outlines the different roles that are
available and what they are allowed to do.

## Resources

The permissions model centres around access to _resources_ in the system. These
resources are: _teams_, _user accounts_, _templates_, _{{notebooks}}_, _map
layers_, and the _system_ as a whole. A role can be given permission to read,
update or create any of these resources. So, for example, the system
administrator can create teams and assign a team administrator who can then
create users and {{notebooks}} within that team.

All users in the system are able to:

- list {{notebooks}} that they have access to
- list templates that they have access to
- list map layers that they are allowed to see
- create and revoke API access tokens

## Global Roles

Global roles apply to the system as a whole and are reserved for
administrative users.

The _Super User_ role has permission to do anything in the system
and should only be used for emergency interventions. Every deployment has a
default user `admin` with this role configured for local login. Other users
can be given this role if necessary but since it has access to user data,
it should be used with caution.

The _Operations Administrator_ role is intended for IT staff managing a deployment.
It has permissions to manage teams and users but will not be able to
see any user data.

### Team Roles

Team roles relate to the management of teams, adding users and managing the templates
and {{notebooks}} in the team.

| Permission                                                               | Member | Member (Creator) | Manager | Administrator |
| :----------------------------------------------------------------------- | :----: | :--------------: | :-----: | :-----------: |
| Read, write and edit records in any {{notebook}} owned by the team       |   ✅   |        ❌        |   ✅    |      ✅       |
| View any templates owned by the team                                     |   ✅   |        ❌        |   ✅    |      ✅       |
| Update the details of the team (name and description)                    |   ❌   |        ❌        |   ✅    |      ✅       |
| Add or remove members to a team                                          |   ❌   |        ❌        |   ✅    |      ✅       |
| Create templates and {{notebooks}} within the team                       |   ❌   |        ✅        |   ✅    |      ✅       |
| Create and manage member invites to the team                             |   ❌   |        ❌        |   ✅    |      ✅       |
| Act as {{notebook}} manager for any {{notebook}} owned by the team       |   ❌   |        ❌        |   ✅    |      ✅       |
| Add or remove managers to the team                                       |   ❌   |        ❌        |   ❌    |      ✅       |
| Act as {{notebook}} administrator for any {{notebook}} owned by the team |   ❌   |        ❌        |   ❌    |      ✅       |
| Act as template manager for any template owned by the team               |   ❌   |        ❌        |   ✅    |      ✅       |
| Act as template administrator for any template owned by the team         |   ❌   |        ❌        |   ❌    |      ✅       |
| View map layers owned by the team                                        |   ✅   |        ❌        |   ✅    |      ✅       |
| Upload a map layer into the team                                         |   ❌   |        ✅        |   ✅    |      ✅       |
| Update map layer details and replace files for team layers               |   ❌   |        ❌        |   ✅    |      ✅       |
| Delete map layers owned by the team                                      |   ❌   |        ❌        |   ❌    |      ✅       |

> ⚠️ **Note**: _Team Member (Creator)_ can create {{notebooks}} but does NOT
> automatically get access to existing team {{notebooks}}. This is by design for
> teaching environments where students create isolated {{notebooks}}. They would
> become _{{Notebook}} Administrator_ for any {{notebooks}} that they create.
> The same pattern applies to map layers: they can upload into the team and
> fully manage layers they uploaded, but they do not automatically see other
> team members' layers.

### Template Roles

Template roles give a user permission to work on a particular template.

| Permission                                      | Guest | Manager | Administrator |
| :---------------------------------------------- | :---: | :-----: | :-----------: |
| View the template                               |  ✅   |   ✅    |      ✅       |
| update all details of a template                |  ❌   |   ✅    |      ✅       |
| archive a template so it is no longer available |  ❌   |   ✅    |      ✅       |
| delete the template after archiving             |  ❌   |   ❌    |      ✅       |

> 💡 **Note**: Template roles are primarily managed through team membership.
> E.g. Team Administrators act as template administrators for team templates.

### Map Layer Roles

Map layer roles control the library of offline map files. They are applied
through team membership and ownership (`createdBy`); they are not assigned to
users one layer at a time.

| Permission                                     | Guest | Manager | Administrator |
| :--------------------------------------------- | :---: | :-----: | :-----------: |
| View the layer and download it for offline use |  ✅   |   ✅    |      ✅       |
| Update the name and description                |  ❌   |   ✅    |      ✅       |
| Replace the uploaded files                     |  ❌   |   ✅    |      ✅       |
| Delete the layer                               |  ❌   |   ❌    |      ✅       |

> 💡 **Note**: Linking a layer to a {{notebook}} is a {{notebook}} manager
> action. Anyone who can open that {{notebook}} (including Guest) can then
> download the layer on a device, even if they cannot see it in the map layer
> library.
>
> Replacing files withdraws the current overlay immediately. Field devices drop
> the old file on their next refresh and download the new one after processing
> finishes. There is a gap with no overlay while the replacement is prepared.

### {{Notebook}} Roles

{{Notebook}} roles relate to actions on a particular {{notebook}}.

| Permission                                                                                      | Guest | Contributor | Manager | Administrator |
| :---------------------------------------------------------------------------------------------- | :---: | :---------: | :-----: | :-----------: |
| Activate the {{notebook}} in the app                                                            |  ✅   |     ✅      |   ✅    |      ✅       |
| Create records in the {{notebook}}                                                              |  ✅   |     ✅      |   ✅    |      ✅       |
| View, edit and mark as deleted any records that they have created                               |  ✅   |     ✅      |   ✅    |      ✅       |
| read, edit and delete records from other users of this {{notebook}} in the app                  |       |     ✅      |   ✅    |      ✅       |
| can update the {{notebook}} metadata and design                                                 |  ❌   |     ❌      |   ✅    |      ✅       |
| can change the status of the {{notebook}} to _closed_                                           |  ❌   |     ❌      |   ✅    |      ✅       |
| can assign a {{notebook}} to a different team                                                   |  ❌   |     ❌      |   ✅    |      ✅       |
| can export data from the {{notebook}} in various formats                                        |  ❌   |     ❌      |   ✅    |      ✅       |
| can create invites for the {{notebook}} and add or remove new guests, contributors and managers |  ❌   |     ❌      |   ✅    |      ✅       |
| add or remove other administrators to the {{notebook}}                                          |  ❌   |     ❌      |   ❌    |      ✅       |
| close the the {{notebook}} (prevents further contributions)                                     |  ❌   |     ❌      |   ✅    |      ✅       |
| archive the {{notebook}} (makes it not visible to users)                                        |  ❌   |     ❌      |   ✅    |      ✅       |
| delete the {{notebook}} after archiving (removes all data)                                      |  ❌   |     ❌      |   ❌    |      ✅       |

> 💡 **Note**: {{Notebook}} roles are primarily managed through team membership.
> E.g. Team Administrators act as {{notebook}} administrators for team templates.
