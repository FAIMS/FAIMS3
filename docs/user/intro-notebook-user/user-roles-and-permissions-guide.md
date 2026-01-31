# User Roles and Permissions Guide

*This guide is for IT staff, change management teams, and project administrators who need to manage users, teams, and {{notebooks}} in {{FAIMS}}. It covers role assignment, access control, and common administrative workflows.*

---

## Introduction

### Who This Guide Is For

This guide is designed for:

- **Change management staff** onboarding users and managing access
- **Project administrators** setting up teams and {{notebooks}}
- **IT staff** supporting {{FAIMS}} deployments

If you're looking to create {{notebooks}} or collect data, see the [Quickstart Guide](./quickstart-creation-and-collection.md) instead.

### What This Guide Covers (and Doesn't)

This guide covers:

- Managing users at system, team, and {{notebook}} levels
- Role assignment and access control
- Common administrative workflows

This guide does **not** cover:

- Template creation or management
- {{Notebook}} design and form building (see [Quickstart Guide](./quickstart-creation-and-collection.md))
- Data collection and record management
- API access and tokens
- System configuration and Single Sign-On (SSO) setup

### UI Patterns at a Glance

Before diving into procedures, here's how management differs across the three areas:

| Location | How to Add User | How to Add Role | How to Change Role | How to Remove |
|----------|-----------------|-----------------|-------------------|---------------|
| **Users** (system) | N/A (provisioned via SSO) | Click "add" button in Roles column | Click × on role badge, then add new role | Click × on role badge (removes role only) |
| **Teams → Users** | Click "+ Add user" or go to **Invites** tab | Click "+" on existing member's row | Click × on role badge, then add new role | Click × on role badge (removes role only), or trash icon (removes user from team) |
| **{{Notebooks}} → Users** | Go to **Invites** tab | N/A (one role per user) | Remove user, then re-invite with desired role | Click trash icon (removes user from {{notebook}}) |

### The Three-Tier Permission Model

{{FAIMS}} uses a role-based permissions system to control access to different functions and data. The model centres around access to **resources**: teams, user accounts, templates, {{notebooks}}, and the system as a whole.

Roles are assigned at three levels:

| Level | Controls |
|-------|----------|
| **System** | Global access and creation rights |
| **Team** | Access within a team and its resources |
| **{{Notebook}}** | Access to specific {{notebooks}} and records |

The nearby diagram shows roles at each level and how team roles automatically grant corresponding {{notebook}} access (virtual roles).

```{image} ../images/permissions-hierarchy.png
:alt: {{FAIMS}} Permissions Hierarchy Diagram showing System Level (General Admin, General Creator, General User), Team Level (Team Administrator, Team Manager, Team Member Contributor, Team Member Creator), and {{Notebook}} Level (Administrator, Manager, Contributor, Guest) with arrows indicating virtual role inheritance from team to {{notebook}} roles
```

### What You Can Do As An Enterprise Administrator

As IT or change management staff, you have been provisioned with:

- **GENERAL_ADMIN** system role — full system control, with inherited Administrator access to all teams and {{notebooks}}

This means you can:

**User management:**

- View all system users and their roles
- Add or remove system roles (GENERAL_USER, GENERAL_CREATOR, GENERAL_ADMIN)
- Reset user passwords (for non-SSO configurations)
- Delete user accounts

**Team management:**

- Create new teams
- Access and manage all teams
- Assign Team Administrator roles to others (only GENERAL_ADMIN can do this)

**{{Notebook}} management:**

- Access and manage all {{notebooks}}
- Edit or delete any {{notebook}} regardless of ownership

> **Note:** If you cannot perform an action described in this guide, contact your system administrator to verify your role assignments.

### What Typical Enterprise Users Can Do By Default

When enterprise users sign in via SSO, they are provisioned with:

- **GENERAL_CREATOR** system role — they can create {{notebooks}} and templates
- **Team Administrator** of their assigned team — they have full control over their team

This means they can immediately:

- Create {{notebooks}} (stand-alone or within their team)
- Invite users to their team and assign team roles
- Invite users to {{notebooks}} they administer and assign {{notebook}} roles
- Manage and update roles for their team members

> **Note:** Users do not have the necessary privileges to create their own teams. Teams are typically created during initial provisioning or by a GENERAL_ADMIN, and users are assigned as Team Administrator of their team.

### What 'General users' Can Do

The most restricted access level is GENERAL_USER, which can:

- List {{notebooks}} they have access to
- List templates they have access to

GENERAL_USERs have to be granted access to a {{notebook}} directly (via {{notebook}} invite) or through relevant team membership to view or use it.

---

## Navigating the {{Dashboard}}

When you log in to the {{FAIMS}} {{Dashboard}}, you'll see a left sidebar with two sections:

### Content

- **{{Notebooks}}** — View and manage data collection {{notebooks}}
- **Templates** — View and manage reusable {{notebook}} templates

### Management

- **Users** — View all system users and their roles (requires appropriate permissions)
- **Teams** — View and manage teams

```{screenshot} user-roles/01-dashboard-sidebar.png
:alt: {{FAIMS}} {{Dashboard}} showing left sidebar with Content section ({{Notebooks}}, Templates) and Management section (Users, Teams), plus the Users list displaying Name, Email, Roles columns with add button and General User role badges
:align: right
```

> **Tip:** Click on any sidebar item to navigate to that section. The breadcrumb at the top (e.g., "Home > Users") shows your current location.

---

## Managing System Users

The **Users** section shows all users in the system with their email addresses and system-level roles.

### How Users Are Created

In an enterprise deployment, users are automatically created when they first sign in via SSO. You cannot manually create user accounts through the {{Dashboard}}. When a user signs in for the first time, they are provisioned with default roles (see "What Typical Users Can Do By Default" above).

### Viewing Users

1. Click **Users** in the left sidebar (under Management)
2. You'll see a table with columns:
   - **Name** — User's display name
   - **Email** — User's email address
   - **Roles** — System roles with "add" button and role badges
   - **Reset Password** — Not applicable for SSO deployments; password management is handled through your institution's identity provider
   - **Remove** — Remove user from system

The screenshot above shows this view, with the sidebar navigation on the left and the Users table in the main content area.

### Understanding System Roles

There are three system roles: **General User** (basic access), **General Creator** (can create {{notebooks}} and templates), and **General Admin** (full system control). For detailed permissions, see **Roles Reference → System-Wide Roles** below.

### Adding a Role to a User

1. Find the user in the Users list
2. In the **Roles** column, click the **add** button
3. Select the role to add from the dropdown
4. The new role badge appears next to any existing roles

```{screenshot} user-roles/03-add-user-role.png
:alt: Roles column in Users list showing the add button clicked, revealing a dropdown menu with role options: GENERAL_USER, GENERAL_ADMIN, and GENERAL_CREATOR
:align: right
```

### Removing a Role from a User

1. Find the user in the Users list
2. In the **Roles** column, locate the role badge you want to remove
3. Click the **×** in the upper-right corner of the role badge
4. The role is removed immediately

Each role badge (visible in the {{Dashboard}} screenshot earlier) has a small **×** in the upper-right corner — click this to remove the role.

> ⚠️ **Warning**: Be careful when removing roles. If you remove GENERAL_CREATOR from a user, they will no longer be able to create {{notebooks}} globally. However, they can still create {{notebooks}} within teams where they have the Team Member (Creator), Team Manager, or Team Administrator role.

**See also:** Troubleshooting → Can't Assign Team Administrator Role

---

## Managing Teams

Teams group users together and provide shared access to {{notebooks}}. When you navigate to a team, you'll see several tabs.

### Creating a Team

Only users with the **GENERAL_ADMIN** system role can create new teams.

1. Click **Teams** in the left sidebar
2. Click the **+ Create Team** button
3. Enter the team details:
   - **Name** — A descriptive name for the team
   - **Description** — Optional description of the team's purpose
4. Click **Create**
5. The new team appears in the Teams list

```{screenshot} user-roles/08-teams-create-dialog.png
:alt: Create Team dialog showing Name field and Description field with Create team button
:align: right
```

After creating a team, you'll typically want to add members and assign a Team Administrator (see "Adding a User to Your Team" below).

> **Note:** Most teams are created during initial provisioning. You'll usually be managing existing teams rather than creating new ones.

### Viewing Your Team

1. Click **Teams** in the left sidebar
2. Click on your team name (teams you administer appear in the expanded sidebar)
3. You'll see tabs: **Details**, **Invites**, **{{Notebooks}}**, **Templates**, **Users**

```{screenshot} user-roles/05-teams-view.png
:alt: Team view for {{FAIMS}} Demo Team showing the tab bar with Details (selected), Invites, {{Notebooks}}, Templates, and Users tabs, plus the Edit button; main panel displays team name, description, Created By (admin), and timestamps
:align: right
```

### Team Tabs Overview

| Tab | Purpose |
|-----|---------|
| **Details** | Team name and description |
| **Invites** | Pending invitations to join the team |
| **{{Notebooks}}** | {{Notebooks}} associated with this team |
| **Templates** | Templates owned by this team |
| **Users** | Current team members and their roles |

### Viewing Team Members

1. Navigate to your team
2. Click the **Users** tab
3. You'll see a table with columns:
   - **Name** — Member's display name
   - **Email** — Member's email address
   - **Roles** — Team role badges with **+** to add roles
   - **Remove** — Red trash icon to remove member

```{screenshot} user-roles/06-teams-users.png
:alt: Team Users tab showing member list with columns for Name, Email, Roles (displaying Team Administrator badges with × for removal and + to add roles), and Remove column with red trash icons
:align: right
```

### Understanding Team Roles

There are four team roles: **Team Administrator** (full control), **Team Manager** (manage members, create {{notebooks}}), **Team Member (Contributor)** (access team resources), and **Team Member (Creator)** (create {{notebooks}} only). Team roles automatically grant corresponding {{notebook}} access — see the permissions diagram in the Introduction or **Roles Reference → Team Roles** below for details.

> ⚠️ **Important**: Team Member (Creator) can create {{notebooks}} but does NOT get automatic access to existing team {{notebooks}}. This role is often used for student or citizen science projects, where it is undesirable for the user to have access to other peoples' {{notebooks}}.

### Adding a User to Your Team

1. Navigate to your team → **Users** tab
2. Click **+ Add user** button above the table
3. Enter the user's email address
4. Select their team role from the dropdown
5. Click **Add**

```{screenshot} user-roles/07-teams-add-user.png
:alt: Add user to team dialog with User Email text field and Role dropdown showing options: Team Member (Contributor), Team Member (Creator), Team Manager, and Team Administrator
:align: right
```

### Adding a Role to an Existing Team Member

1. Navigate to your team → **Users** tab
2. Find the member in the list
3. In the **Roles** column, click the **+** button
4. Select the additional role
5. The new role badge appears

### Removing a Role from a Team Member

1. Navigate to your team → **Users** tab
2. Find the member in the list
3. In the **Roles** column, click the **×** on the role badge you want to remove

### Removing a Member from Your Team

1. Navigate to your team → **Users** tab
2. Find the member in the list
3. Click the red **trash icon** in the Remove column
4. Confirm removal when prompted

The screenshot in the "Viewing Team Members" section above shows the red trash icons in the Remove column.

> ⚠️ **Warning**: Removing someone from a team removes their automatic (virtual) access to ALL team {{notebooks}}. If they have direct {{notebook}} roles, that access persists until separately removed.

### Managing Team Invites

The **Invites** tab allows you to create invitation links that users can use to join your team.

#### Creating a Team Invitation

1. Navigate to your team
2. Click the **Invites** tab
3. Click **+ Create Invite**
4. Configure the invitation:
   - **Role** — The team role new members will receive
   - **Expiry** — When the invitation expires (see below)
   - **Uses** — How many times the invite can be used (optional)
5. Click **Create Invite**

```{screenshot} user-roles/08b-teams-create-invite.png
:alt: Create Team Invite dialog showing Role dropdown with team roles, Expiry date field, and Create Invite button
:align: right
```

#### Understanding Invite Options

| Option | Description |
|--------|-------------|
| **Expiry** | The date/time after which the invite link no longer works. Expired invites cannot be extended — create a new one instead. |
| **Uses remaining** | Limits how many people can use this invite. Use multi-use invites for workshops or group onboarding. Leave unlimited (default) for open invitations. |
| **Code** | A short code users can enter manually |
| **Link** | A URL that users can click to accept the invitation |
| **QR Code** | Scannable code for mobile devices — useful for in-person onboarding |

#### Viewing and Managing Invites

The Invites tab shows all active invitations with their status.

```{screenshot} user-roles/08a-teams-invites-tab.png
:alt: Team Invites tab showing list of pending invitations with columns for Name, Role, Expiry, Uses remaining, Code, Link, QR Code, and Remove
:align: right
```

From here you can:

- See how many uses remain on each invite
- Check expiry dates
- Remove invites that are no longer needed (click the trash icon)

**See also:**

- Managing {{Notebook}} Users → Inviting Users to a {{Notebook}} (similar process)
- Troubleshooting → Can't Add Users to Team
- Troubleshooting → User Has Access But Shouldn't

---

## Managing {{Notebook}} Users

{{Notebooks}} have their own user management, separate from teams. Users can access {{notebooks}} either through team membership (virtual roles) or direct assignment.

### Viewing {{Notebook}} Users

1. Click **{{Notebooks}}** in the left sidebar

```{screenshot} user-roles/09a-notebooks-view.png
:alt: {{Notebooks}} list view showing sidebar with {{Notebooks}} expanded, and main content area with table columns for Name, Team, Template, {{Notebook}} Lead, and Description
:align: right
```

2. Click on a {{notebook}} name
3. Click the **Users** tab
4. You'll see a table with columns:
   - **Name** — User's display name
   - **Email** — User's email address
   - **{{Notebook}} Roles** — Current role (display only)
   - **Remove** — Trash icon to remove user

```{screenshot} user-roles/09b-notebooks-users.png
:alt: {{Notebook}} Users tab showing user list with Name column, {{Notebook}} Roles column (displaying Administrator badges), and Remove column with trash icons
:align: right
```

### Understanding {{Notebook}} Roles

There are four {{notebook}} roles: **Administrator** (full control, can delete {{notebook}}), **Manager** (edit design, export, manage access), **Contributor** (edit others' records), and **Guest** (own records only). For detailed permissions, see **Roles Reference → {{Notebook}} Roles** and the **Permission Matrix** below.

### How {{Notebook}} Access Works

Users can have {{notebook}} access from two sources:

1. **Virtual roles** — Automatic access from team membership (see the permissions diagram in the Introduction for the mapping)
2. **Direct roles** — Explicitly assigned to this {{notebook}} via invitation

> **Note:** Direct roles override virtual roles. If a Team Member (Contributor) is directly assigned as Guest on a specific {{notebook}}, they have Guest access to that {{notebook}}.

### Inviting Users to a {{Notebook}}

Unlike Teams and Users, you **cannot change roles directly** in the {{notebook}} Users tab. To add users or change roles:

1. Navigate to your {{notebook}}
2. Click the **Invites** tab
3. Click **+ Invite user** (or similar button)
4. Enter the user's email address
5. Select their {{notebook}} role (Administrator, Manager, Contributor, or Guest)
6. Send the invitation

```{screenshot} user-roles/10-notebooks-invite.png
:alt: Create Invite dialog for a {{notebook}} showing Invite title field, Role dropdown with options (Administrator, Manager, Contributor, Guest), expiry date selection with Quick Select and Custom Date options, and Create Invite button
:align: right
```

Once created, invitations appear in the **Invites** tab where you can manage them:

```{screenshot} user-roles/11-notebooks-invites-active.png
:alt: {{Notebook}} Invites tab showing list of active invitations with columns for Name, Role, Expiry, Uses remaining, Code, Link, QR Code, and Remove; includes + Create Invite button
:align: right
```

The Invites tab shows:

| Column | Description |
|--------|-------------|
| **Name** | The invitation title/description |
| **Role** | The {{notebook}} role recipients will receive |
| **Expiry** | When the invite expires — create a new invite if one expires |
| **Uses remaining** | How many more people can use this invite |
| **Code** | Short code for manual entry |
| **Link** | Clickable URL to share |
| **QR Code** | Scannable code for mobile onboarding |

> **Tip:** Use multi-use invites with QR codes for field team onboarding sessions. Each team member can scan the same code to join with the appropriate role.

### Removing a User from a {{Notebook}}

1. Navigate to the {{notebook}} → **Users** tab
2. Find the user in the list
3. Click the **trash icon** in the Remove column
4. Confirm removal

> **Note:** Removing a direct role doesn't remove team membership. If the user has a team role, they'll still have virtual access through the team.

### Transferring {{Notebook}} Ownership

To hand off a {{notebook}} to someone else:

1. Go to the {{notebook}} → **Invites** tab
2. Invite the new owner with **Administrator** role
3. Once they accept, they have full control
4. Optionally remove yourself via the **Users** tab

> ⚠️ **Warning**: Always ensure at least one Administrator remains on every {{notebook}}.

**See also:**

- Troubleshooting → Can't See a {{Notebook}}
- Troubleshooting → Can't Change a User's {{Notebook}} Role

---

## Quick Reference

### When to Use Each Role

| Scenario | Recommended Role |
|----------|------------------|
| Project lead who manages everything | Team Administrator + {{notebook}} Administrator |
| Researcher who designs forms | Team Manager or {{notebook}} Manager |
| Field worker collecting data | Team Member (Contributor) or {{notebook}} Contributor |
| External reviewer (limited access) | {{Notebook}} Guest |
| Someone who creates {{notebooks}} but shouldn't see others' data | Team Member (Creator) |

---

## Common Scenarios

### Onboarding a New Staff Member

1. They sign in via SSO (automatically get GENERAL_CREATOR + their own team)
2. Navigate to your team → **Users** tab → **+ Add user**
3. Enter their email and select **Team Member (Contributor)**
4. They now have Contributor access to all your team's {{notebooks}}

### Setting Up a Project Team

1. Create {{notebook}}(s) for the project ({{Notebooks}} → Create {{Notebook}})
2. Ensure {{notebooks}} are associated with your team
3. Add team members with appropriate roles:
   - Project lead: Team Manager or Team Administrator
   - Researchers: Team Member (Contributor)
   - External collaborators: Invite directly to specific {{notebooks}}

### Granting External Collaborator Access

**Option A — Add to team** (ongoing access):

1. Add them to your team as Team Member (Contributor)
2. They get virtual access to all team {{notebooks}}

**Option B — {{Notebook}} only** (limited scope):

1. Go to the specific {{notebook}} → **Invites** tab
2. Invite them with Contributor or Guest role
3. They don't need team membership

### Handing Off a Project

1. {{Notebook}} → **Invites** tab → Invite colleague as **Administrator**
2. Verify they can access and manage the {{notebook}}
3. Optionally remove yourself from the Users tab

### Off-boarding: Removing All Access

1. **Remove from {{notebooks}}** (if they have direct roles):
   - Navigate to each {{notebook}} → Users tab → trash icon
2. **Remove from team**:
   - Navigate to team → Users tab → red trash icon
3. **Note**: You cannot revoke system roles — contact a GENERAL_ADMIN

---

## Roles Reference

### System-Wide Roles

| Role | Display Name | Description | Typical User |
|------|--------------|-------------|--------------|
| GENERAL_USER | General User | View assigned resources, manage own tokens | Rarely used alone |
| GENERAL_CREATOR | General Creator | Create {{notebooks}} and templates globally | Researchers, project managers |
| GENERAL_ADMIN | General Admin | Full system control, manage all users | IT administrators |

### Team Roles

| Role | Display Name | Permissions | Virtual {{Notebook}} Role |
|------|--------------|-------------|----------------------|
| TEAM_ADMIN | Team Administrator | Full team control | Administrator |
| TEAM_MANAGER | Team Manager | Manage members, create {{notebooks}} | Manager |
| TEAM_MEMBER | Team Member (Contributor) | Access team resources | Contributor |
| TEAM_MEMBER_CREATOR | Team Member (Creator) | Create {{notebooks}} only | **None** (no access to other team {{notebooks}}) |

> ⚠️ **Key restriction**: Only GENERAL_ADMIN can assign Team Administrator role. Team Member (Creator) cannot see other team {{notebooks}} — they must be explicitly invited.

### {{Notebook}} Roles

| Role | Display Name | Permissions |
|------|--------------|-------------|
| PROJECT_ADMIN | Administrator | Full control, manage administrators, delete {{notebook}} |
| PROJECT_MANAGER | Manager | Edit design, close {{notebook}}, reassign team, export, manage invites/access |
| PROJECT_CONTRIBUTOR | Contributor | Edit others' records (plus all Guest permissions) |
| PROJECT_GUEST | Guest | Activate {{notebook}}, create records, view/edit/delete own records |

### Permission Matrix — {{Notebooks}}

| Action | Guest | Contributor | Manager | Administrator |
|--------|:-----:|:-----------:|:-------:|:-------------:|
| Activate {{notebook}} | ✅ | ✅ | ✅ | ✅ |
| Create records | ✅ | ✅ | ✅ | ✅ |
| View/edit/delete own records | ✅ | ✅ | ✅ | ✅ |
| Edit others' records | ❌ | ✅ | ✅ | ✅ |
| Update {{notebook}} metadata/design | ❌ | ❌ | ✅ | ✅ |
| Close {{notebook}} | ❌ | ❌ | ✅ | ✅ |
| Reassign to different team | ❌ | ❌ | ✅ | ✅ |
| Export own data | ❌ | ✅ | ✅ | ✅ |
| Export all {{notebook}} data | ❌ | ❌ | ✅ | ✅ |
| Manage invites and access | ❌ | ❌ | ✅ | ✅ |
| Manage administrators | ❌ | ❌ | ❌ | ✅ |
| Delete {{notebook}} | ❌ | ❌ | ❌ | ✅ |

### Permission Matrix — Teams

| Action | Member (Contributor) | Member (Creator) | Manager | Administrator |
|--------|:--------------------:|:----------------:|:-------:|:-------------:|
| View team details | ✅ | ✅ | ✅ | ✅ |
| View team templates | ✅ | ✅ | ✅ | ✅ |
| Read/write/edit records in team {{notebooks}} | ✅ | ❌ | ✅ | ✅ |
| Create {{notebooks}} in team | ❌ | ✅ | ✅ | ✅ |
| Create templates in team | ❌ | ❌ | ✅ | ✅ |
| Update team details | ❌ | ❌ | ✅ | ✅ |
| Add/remove team members | ❌ | ❌ | ✅ | ✅ |
| Manage member invites | ❌ | ❌ | ✅ | ✅ |
| Act as {{notebook}} manager (virtual role) | ❌ | ❌ | ✅ | ✅ |
| Add/remove team managers | ❌ | ❌ | ❌ | ✅ |
| Act as {{notebook}}/template administrator | ❌ | ❌ | ❌ | ✅ |

> ⚠️ **Note**: Team Member (Creator) can create {{notebooks}} but does NOT automatically get access to existing team {{notebooks}}. This is by design for teaching environments where students create isolated {{notebooks}}.

---

## Troubleshooting

### Can't See a {{Notebook}}

**Possible causes**:

- Not a member of the team that owns the {{notebook}}
- Team role is Team Member (Creator) — doesn't grant automatic access
- Not directly invited to the {{notebook}}

**Solution**: Check team membership and role. Add direct {{notebook}} access via Invites tab if needed.

### Can't Edit {{Notebook}} Structure

**Cause**: Missing Manager or Administrator role on the {{notebook}}.

**Solution**: Have a {{notebook}} Administrator invite you with Manager or Administrator role.

### Can't Add Users to Team

**Cause**: Missing Team Manager or Team Administrator role.

**Solution**: Have a Team Administrator elevate your team role.

### Can't Assign Team Administrator Role

**Cause**: Only GENERAL_ADMIN can assign Team Administrator roles.

**Solution**: Contact your system administrator.

### User Has Access But Shouldn't

**Cause**: User may have both direct and virtual (team-based) roles.

**Solution**: Check both:

1. Direct {{notebook}} roles ({{Notebook}} → Users tab)
2. Team membership (Team → Users tab)

Remove from both locations if needed.

### Can't Change a User's {{Notebook}} Role

**Note**: The {{Notebook}} Users tab only displays roles — you cannot edit them there.

**Solution**: Remove the user (trash icon), then re-invite via the **Invites** tab with the new role.

---

## Further Resources

- [Quickstart Guide](./quickstart-creation-and-collection.md) — Creating {{notebooks}} and collecting data

---

*Guide Version: 1.4*
*Last Updated: 2026-01-19*
