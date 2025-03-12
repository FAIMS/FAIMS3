(advanced/user-management)=
# User Management

How to get allocate and manage users with Fieldmark

:::{note}
This feature is presently in development.
:::

## Conductor user management via datacentral profile

1. Find the notebook key for the notebook you wish to add users for. (It is after the %7C%7C in the URL). Copy it.
1. As a notebook administrator, log into your conductor server (after having logged into Fieldmark)
2. Go to the `Assigned Roles` box
3. Click Invite users to roles
4. Input their datacentral email into email, the notebook key into notebook key, and `admin` in to role. You will seldom want to put `team`, as this limits the records they can read to only their own.
5. Tell the user to, after logging into Fieldmark, visit the conductor server. Then they need to click `Check my invites` and accept their invites.