(intro/user-roles)=
# Users and Roles

In this Guide we explain the different types of user accounts and their roles in Fieldmark.

Users can be granted permission to see and edit Notebooks, individual records in notebooks and Workspaces depending on the way their account has been registered by the Administrator. It is important to be aware of your login details when using Fieldmark.  

## Being a user in the Fieldmark app

### How to check your Account credentials

If you are unsure which account you have logged in as, check the name which appears in to the top right hand corner of the screen: 

:::{image} user-images/accountlogin.jpg
:align: center
:::


### See your account details

Users can see their currently logged in status by going to the User page from the navigation bar (the menu icon <span class="material-icons">menu</span> in the top left).

:::{image} /common-images/navigationbar.png
:align: center
:width: 20%
:::

Once they click User, they will see:

:::{image} user-images/user-demo.3.faims.edu.au_signin.png
:align: center
:width: 50%
:::

This will list their {term}`Role`s, allow them to reconnect to the {term}`Conductor` by clicking [Refresh]{.fieldmark-button}, or even change the active user.

(intro/users/switching)=
### Changing the active user

If you are sharing devices with colleagues on the same field campaign, you may wish to stay logged in to different accounts and switching between them for different tasks. 

Additional, offline capable users may be added by selecting the [Add Another User]{.fieldmark-button} button on the User page. The active user may be determined by selecting their name in the dropdown and pushing [Switch]{.blue-button}


### Adding other logged in users to the app

To add another **Google** account, follow the link at the bottom of the User screen.

If you are signed in with **Data Central** and wish to add another Data Central user you need to sign out using the [DC logout](https://auth.datacentral.org.au/cas/logout) first (as Data Central only allows for one signed-in user at a time). Once you have signed in with a different user you can switch between both users.


## User Roles in Fieldmark

Fieldmark has three tiers of roles:

* Users
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




<link href="https://fonts.googleapis.com/icon?family=Material+Icons"
      rel="stylesheet">