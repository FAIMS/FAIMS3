# User Roles in {{Fieldmark}}

{{Fieldmark}} has three tiers of roles:

* General Users
* Notebook Administrators
* Server Administrators

### Users
:::{index} user-role; user
:::


The default type of Fieldmark user (Role=User). They can:

- see and activate any Notebooks that have been made available to them by an administrator
- create and edit their own records in those Notebooks
- create local Notebooks but not share them with other users

A User cannot:

- see or edit the records of other Users
- see Notebooks unless granted permission by an administrator

### Administrators
:::{index} user-role; administrator
:::

There are two types of administrators:

- Notebook Administrators (Role=Admin)
- Server Administrators (Role=ClusterAdmin)

Notebook Administrators (Admins) can:

- do everything a User can,
- see and edit records created by other users, and
- give permission for other Users to access a Notebook.

Server Administrators (ClusterAdmins) can:

- do everything that a Notebook Administrator can
- give permission for other Admins to manage a Notebook
- see all Notebooks on the Workspace
- create and edit Notebooks to be shared with other Users in their Team or Enterprise.

For instructions of how to manage user groups go to [User Management](advanced/user-management).
