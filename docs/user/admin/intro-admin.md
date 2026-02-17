# Managing {{FAIMS}}

This document provides an overview of {{FAIMS}} from the perspective of
the IT team managing a deployment within an enterprise.

## System Overview

{{FAIMS}} is a system for collecting data in the field using a mobile application.
The mobile app is backed by a central API server and a CouchDB database.  There is
also a web based version of the data collection app and a web based dashboard
application that supports management tasks.  The relevant URLs for this deployment are
as follows:

- {{Dashboard}} ({{WEB_URL}}) provides a management interface for users and data
- Web App ({{APP_URL}}) provides a web based version of the data collection app
- API server ({{API_URL}}) provides core authentication and data services to the apps

Your main entry point for administration is the {{Dashboard}} application. 

## Users, Teams and {{Notebooks}}

Users in the system can be grouped into *Teams* or they can be standalone.  Teams are
able to share some resources such as {{notebooks}} or {{notebook}} templates and can
collaborate on data collection and analysis.  

{{Notebooks}} are used to collect data using a set of forms.  Users will create
one or more {{notebooks}} with the different forms they need for data collection.
{{Notebooks}} can be owned by a team or by an individual user.  Access to {{notebooks}}
is determined by user roles.

## User Roles

Users can be assigned to one or more *roles* within the system.  Permissions
associated with roles relate to either the system as a whole,
teams or {{notebooks}}.

The details of the different roles are outlined in [Roles and Permissions](../core/permissions.md).
As an administrator, one of your roles should be *Operations Administrator*; this grants you 
full control over users and teams in the system.

Note that there is also an elevated *General Administrator* role that has all permissions
over both users and their notebooks and data.  This is not a generally used role
and would be reserved for emergency interventions only.

## Provisioning Users

{{FAIMS}} can be configured to allow either local login or SSO via an authentication
provider.  This determines how a user will authenticate with the system.  

Users are provisioned into the system only when the register for the first time.  An
account is made with the supplied credentials.  The system stores only the full name
and email address of the user along with a record of the authentication source.

User registration is managed through **invitations**.  Administrative users with
sufficient permissions can create invitations for either a *team* or a *{{notebook}}*.
The invitation is associated with a given role, so, for example, you can create
an invitation to be *Team Administrator* or a *{{Notebook}} Contributor*.  In turn
a *Team Administrator* can create invites to lesser roles within that team.

### Inviting Admin Users

A user with the *Operations Administrator* role can create new invitations for global
roles to allow adding new administrators.  This can be done via the *Users* tab in
the {{Dashboard}}. Click on *Invites* to add a new invite for a global role.  The invite
should have a short validity period and be valid for only the target number of users.
Copy the *Invitation URL* and send this to the target admin users.

### Suggested Onboarding Workflow

In an enterprise, we suggest that central administration should provision new teams
for groups of users working on well defined projects.  The *Team Administrator* can
then invite other users to join the group and manage their roles within the group.
Central support does not need to be involved in provisioning every user into the system.

A user requests a new team for a recently funded project.

1. Create the team (perhaps with a naming convention that allows you to keep track)
1. Create an invite in the team for the role *Team Administrator*, apply a limit of one use for the invite and a suitable validity time
1. Copy the *Invitation URL* and send this to the user
1. User follows the invitation URL and is able to register a new account

If the user has already registered an account, the above procedure can still be used
if you wish to give them a new team, for example for another funded project.

If there is more than one user who should be administrators on the team, set the usage
limit for the invite accordingly: allow two uses for two administrative users.

## Removing Users

There is currently no provision for removing users from the system; this capability
is on our roadmap but we need to understand the requirements for enterprise users
more fully before implementation.

## Managing Users

Existing users can be managed through the [{{dashboard}}](../core/web.md) interface. From here
you can grant or remove roles and generate a password-reset link (for non-SSO users).
