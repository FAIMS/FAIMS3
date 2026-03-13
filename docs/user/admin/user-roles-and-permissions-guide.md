# User Roles and Permissions Guide

*This guide is for IT staff, change management teams, and project administrators who need to manage users, teams, and {{notebooks}} in {{FAIMS}}. It covers role assignment, access control, and common administrative workflows.*

---

## Introduction

### Who This Guide Is For

This guide is designed for:

- **Change management staff** onboarding users and managing access
- **Project administrators** setting up teams and {{notebooks}}
- **IT staff** supporting {{FAIMS}} deployments

If you're looking to create {{notebooks}} or collect data, see the [Quickstart Guide](../authoring/quick-start-researchers.md) instead.

### What This Guide Covers (and Doesn't)

This guide covers:

- Managing users at system, team, and {{notebook}} levels
- Role assignment and access control
- Common administrative workflows

This guide does **not** cover:

- Template creation or management
- {{Notebook}} design and form building (see [Quickstart Guide](../authoring/quick-start-researchers.md))
- Data collection and record management
- API access and tokens
- System configuration and Single Sign-On (SSO) setup

### UI Patterns at a Glance

Before diving into procedures, here's how management differs across the three areas:

| Location | How to Add User | How to Add Role | How to Change Role | How to Remove |
|----------|-----------------|-----------------|-------------------|---------------|
| **Users** (system) | Create a global invite (Users → Invites tab) | Click "add" button in Roles column | Click × on role badge, then add new role | Click × on role badge (removes role only) |
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

```{image} ../images/permissions-hierarchy-v2-3.jpeg
:alt: Permissions Hierarchy Diagram showing System Level (Super User, Operations Administrator, Content Creator, General User), Team Level (Team Administrator, Team Manager, Team Member (Contributor), Team Member (Creator)), and {{Notebook}} Level (Administrator, Manager, Contributor, Guest) with arrows indicating virtual role inheritance from team to {{notebook}} roles. Sidebar shows virtual role inheritance and access sources. Warning callouts highlight that Operations Administrator has no data access and Team Member (Creator) has no automatic access to existing team {{notebooks}}.
```

### What You Can Do As An Enterprise Administrator

As IT or change management staff, you have been provisioned with:

- **Super User** system role — full system control, with inherited Administrator access to all teams and {{notebooks}}

> ⚠️ **Recommendation**: For routine operations (user management, team creation), use the **Operations Administrator** role instead. Super User is an emergency break-glass role that also grants full access to all research data.

This means you can:

**User management:**

- View all system users and their roles
- Add or remove system roles (General User, Content Creator, Operations Administrator, Super User)
- Reset user passwords (for non-SSO configurations)
- Remove user accounts

**Team management:**

- Create new teams
- Access and manage all teams
- Assign Team Administrator roles to others (only Operations Administrator or Super User can do this)

**{{Notebook}} management:**

- Access and manage all {{notebooks}}
- Edit or close any {{notebook}} regardless of ownership

> **Note:** If you cannot perform an action described in this guide, contact your system administrator to verify your role assignments.

### What Operations Administrators Can Do

The **Operations Administrator** role handles routine system management without access to research data:

**User and team management:**

- View all system users and their roles
- Add or remove system roles
- Create new teams
- Assign Team Administrator roles

**Cannot do (by design):**

- Access {{notebooks}}, templates, or research data
- The {{Notebooks}} and Templates sidebar items are hidden from this role

> **Note:** If you need both administrative control and {{notebook}} access, you need the Super User role.

### What Typical Enterprise Users Can Do By Default

During onboarding, enterprise users are typically assigned:

- **Content Creator** system role — they can create {{notebooks}} and templates
- **Team Administrator** of their assigned team — they have full control over their team

These roles are granted through invites created by an Operations Administrator or Super User (see "How Users Are Created" below). Once onboarded, a typical user can immediately:

- Create {{notebooks}} (stand-alone or within their team)
- Invite users to their team and assign team roles
- Invite users to {{notebooks}} they administer and assign {{notebook}} roles
- Manage and update roles for their team members

> **Note:** Users do not have the necessary privileges to create their own teams. Teams are typically created by a Super User or Operations Administrator during onboarding, and users are assigned as Team Administrator of their team via an invite.

### What 'General users' Can Do

The most restricted access level is General User, which can:

- List {{notebooks}} they have access to
- List templates they have access to

General Users have to be granted access to a {{notebook}} directly (via {{notebook}} invite) or through relevant team membership to view or use it.

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
:alt: {{FAIMS}} {{Dashboard}} showing left sidebar with Content section ({{Notebooks}}, Templates) and Management section (Users, Teams), plus the Users page with Users and Invites tabs, displaying Name, Email, Roles columns with role badges such as General User and Super User
:align: right
:width: 100%
```

> **Tip:** Click on any sidebar item to navigate to that section. The breadcrumb at the top (e.g., "Home > Users") shows your current location.

---

## Managing System Users

The **Users** section shows all users in the system with their email addresses and system-level roles.

### How Users Are Created

In an enterprise deployment, users are created through an invite-based workflow:

1. An Operations Administrator (or Super User) creates an invite — either a global invite for system roles (Users → Invites tab), or a team invite for team roles (Team → Invites tab)
2. The invite is shared with the user via a code, link, or QR code
3. The user accepts the invite and completes sign-in via Single Sign-On (SSO) — this creates their account
4. The user's roles are determined by the invite(s) they accepted, not auto-provisioned

You cannot manually create user accounts through the {{Dashboard}} — users must accept an invite and sign in via SSO to create their account.

> **Note:** SSO auto-provisioning (where user accounts are automatically created on first SSO sign-in with default roles) is under development but not yet deployed. Currently, all user creation requires an invite.

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

There are four system roles: **General User** (basic access), **Content Creator** (can create {{notebooks}} and templates), **Operations Administrator** (manage users and teams without data access), and **Super User** (full system control — emergency use). For detailed permissions, see **Roles Reference → System-Wide Roles** below.

### Adding a Role to a User

1. Find the user in the Users list
2. In the **Roles** column, click the **add** button
3. Select the role to add from the dropdown
4. The new role badge appears next to any existing roles

```{screenshot} user-roles/03-add-user-role.png
:alt: Roles column in Users list showing the add button clicked, revealing a dropdown menu with four role options: General User, Super User, Content Creator, and Operations Administrator
:align: right
:width: 100%
```

### Removing a Role from a User

1. Find the user in the Users list
2. In the **Roles** column, locate the role badge you want to remove
3. Click the **×** in the upper-right corner of the role badge
4. The role is removed immediately

Each role badge (visible in the {{Dashboard}} screenshot earlier) has a small **×** in the upper-right corner — click this to remove the role.

> ⚠️ **Warning**: Be careful when removing roles. If you remove Content Creator from a user, they will no longer be able to create {{notebooks}} globally. However, they can still create {{notebooks}} within teams where they have the Team Member (Creator), Team Manager, or Team Administrator role.

**See also:** Troubleshooting → Can't Assign Team Administrator Role

---

## Managing Global Invites

The **Users** page has two tabs: **Users** (described above) and **Invites**. The Invites tab lets you create invitation links that grant system-level roles to new or existing users — for example, inviting someone to become an Operations Administrator.

> 💡 **Note**: Global invites are for **system-level roles** only. To invite users to a specific team or {{notebook}}, use team invites or {{notebook}} invites instead (see below).

### Who Can Manage Global Invites

Only users with the **Operations Administrator** or **Super User** system role can view and manage global invites.

### Viewing Global Invites

1. Click **Users** in the left sidebar (under Management)
2. Click the **Invites** tab (next to the Users tab)
3. You'll see a table of active invitations with columns:
   - **Name** — Descriptive title for the invitation
   - **Role** — The system role invitees will receive (displayed as a role badge)
   - **Expiry** — When the invitation expires
   - **Uses remaining** — How many more times the invite can be used
   - **Code** — A short code users can enter manually (click to copy)
   - **Link** — A URL users can click to accept the invitation (click to copy)
   - **QR Code** — Click to display a scannable QR code for mobile devices
   - **Remove** — Delete the invitation

```{screenshot} user-roles/02-users-invites-tab.png
:alt: Users page Invites tab showing a table of global invitations with columns for Name, Role, Expiry, Uses remaining, Code, Link, QR Code, and Remove
:align: right
:width: 100%
```

### Creating a Global Invitation

1. Navigate to **Users** → **Invites** tab
2. Click **+ Create Global Invite**
3. Configure the invitation:
   - **Invite title** — A descriptive name (e.g., "Operations team onboarding Q1")
   - **Role** — The system role invitees will receive (General User, Content Creator, or Operations Administrator)
   - **Maximum uses** — How many times the invite can be used (leave empty for unlimited)
   - **Invite Duration** — Choose a preset duration (Quick Select) or a specific date (Custom Date); maximum 365 days
4. Click **Create Invite**

```{screenshot} user-roles/02a-create-global-invite.png
:alt: Create Global Invite dialog with fields for invite title, role selection, maximum uses, and invite duration with Quick Select and Custom Date options
:align: right
:width: 100%
```

> 💡 **Note**: The **Super User** role is deliberately excluded from the role dropdown. Super User access must be granted manually through the Users tab to prevent accidental distribution of full system privileges.

### Removing a Global Invite

To remove an invitation that is no longer needed, click the red **trash icon** in the Remove column of the Invites table. The invite link and code will immediately stop working.

**See also:**

- Managing Teams → Managing Team Invites (similar process for team-level roles)
- Managing {{Notebook}} Users → Inviting Users to a {{Notebook}} (similar process for {{notebook}}-level roles)

---

## Managing Teams

Teams group users together and provide shared access to {{notebooks}}. When you navigate to a team, you'll see several tabs.

### Creating a Team

Only users with the **Super User** or **Operations Administrator** system role can create new teams.

1. Click **Teams** in the left sidebar
2. Click the **+ Create Team** button
3. Enter the team details:
   - **Name** — A descriptive name for the team
   - **Description** — Optional description of the team's purpose
4. Click **Create team**
5. The new team appears in the Teams list

```{screenshot} user-roles/08-teams-create-dialog.png
:alt: Create Team dialog showing Name field and Description field with Create team button
:align: right
:width: 100%
```

After creating a team, you'll typically want to add members and assign a Team Administrator (see "Adding a User to Your Team" below).

> **Note:** Most teams are created during initial provisioning. You'll usually be managing existing teams rather than creating new ones.

### Viewing Your Team

1. Click **Teams** in the left sidebar
2. Click on your team name (teams you administer appear in the expanded sidebar)
3. You'll see tabs: **Details**, **Invites**, **{{Notebooks}}**, **Templates**, **Users**

```{screenshot} user-roles/05-teams-view.png
:alt: Team view for {{FAIMS}} showing the tab bar with Details (selected), Invites, {{Notebooks}}, Templates, and Users tabs, plus the Edit button; main panel displays team name, description, Created By (admin), and timestamps
:align: right
:width: 100%
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
:width: 100%
```

### Understanding Team Roles

There are four team roles: **Team Administrator** (full control), **Team Manager** (manage members, create {{notebooks}}), **Team Member (Contributor)** (access team resources), and **Team Member (Creator)** (create {{notebooks}} only). Team roles automatically grant corresponding {{notebook}} access — see the permissions diagram in the Introduction or **Roles Reference → Team Roles** below for details.

> ⚠️ **Important**: Team Member (Creator) can create {{notebooks}} but does NOT get automatic access to existing team {{notebooks}}. This role is often used for student or citizen science projects, where it is undesirable for the user to have access to other peoples' {{notebooks}}.

### Adding a User to Your Team

1. Navigate to your team → **Users** tab
2. Click **+ Add user** button above the table
3. Enter the user's email address
4. Select their team role from the dropdown
5. Click **Add User**

```{screenshot} user-roles/07-teams-add-user.png
:alt: Add user to team dialog with User Email text field and Role dropdown showing options: Team Member (Contributor), Team Member (Creator), Team Manager, and Team Administrator
:align: right
:width: 100%
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
3. Click **+ Create Team Invite**
4. Configure the invitation:
   - **Invite title** — A descriptive name for the invitation
   - **Role** — The team role new members will receive
   - **Uses** — How many times the invite can be used (leave empty for unlimited)
   - **Expiry** — When the invitation expires (see below)
5. Click **Create Invite**

```{screenshot} user-roles/08b-teams-create-invite.png
:alt: Create Team Invite dialog showing Role dropdown with team roles, Expiry date field, and Create Invite button
:align: right
:width: 100%
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
:width: 100%
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
:width: 100%
```

2. Click on a {{notebook}} name
3. Click the **Users** tab
4. You'll see a table with columns:
   - **Name** — User's display name
   - **{{Notebook}} Roles** — Current role (display only)
   - **Remove** — Trash icon to remove user

```{screenshot} user-roles/09b-notebooks-users.png
:alt: {{Notebook}} Users tab showing user list with Name column, {{Notebook}} Roles column (displaying Administrator badges), and Remove column with trash icons
:align: right
:width: 100%
```

### {{Notebook}} Tabs Overview

| Tab | Purpose |
|-----|---------|
| **Details** | {{Notebook}} name, description, and metadata |
| **Invites** | Invitation links for adding users |
| **Users** | Current {{notebook}} users and their roles |
| **Export** | Export {{notebook}} data |
| **Actions** | Edit {{notebook}}, assign to team, download/replace JSON, {{notebook}} status |

### Understanding {{Notebook}} Roles

There are four {{notebook}} roles: **Administrator** (full control, can manage administrators), **Manager** (edit design, export, manage access), **Contributor** (edit others' records), and **Guest** (own records only). For detailed permissions, see **Roles Reference → {{Notebook}} Roles** and the **Permission Matrix** below.

### How {{Notebook}} Access Works

Users can have {{notebook}} access from two sources:

1. **Virtual roles** — Automatic access from team membership (see the permissions diagram in the Introduction for the mapping)
2. **Direct roles** — Explicitly assigned to this {{notebook}} via invitation

> **Note:** Direct roles override virtual roles. If a Team Member (Contributor) is directly assigned as Guest on a specific {{notebook}}, they have Guest access to that {{notebook}}.

### Inviting Users to a {{Notebook}}

Unlike Teams, you **cannot add users directly** to a {{notebook}}. Instead, you create invitation links that users can accept to join with a specific role.

1. Navigate to your {{notebook}}
2. Click the **Invites** tab
3. Click **+ Create Invite**
4. Configure the invitation:
   - **Invite title** — A descriptive name for the invitation (e.g., "Field team contributor access")
   - **Role** — The {{notebook}} role recipients will receive (Administrator, Manager, Contributor, or Guest)
   - **Uses** — How many times the invite can be used (leave empty for unlimited)
   - **Expiry** — When the invitation expires
5. Click **Create Invite**

```{screenshot} user-roles/10-notebooks-invite.png
:alt: Create Invite dialog for a {{notebook}} showing Invite title field, Role dropdown with options (Administrator, Manager, Contributor, Guest), expiry date selection with Quick Select and Custom Date options, and Create Invite button
:align: right
:width: 100%
```

Once created, invitations appear in the **Invites** tab where you can manage them:

```{screenshot} user-roles/11-notebooks-invites-active.png
:alt: {{Notebook}} Invites tab showing list of active invitations with columns for Name, Role, Expiry, Uses remaining, Code, Link, QR Code, and Remove; includes + Create Invite button
:align: right
:width: 100%
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

### Onboarding a New Researcher (Typical Pathway)

1. An Operations Administrator creates a new team for the researcher (Teams → **+ Create Team**)
2. Create a Team Administrator invite for the new team (Team → **Invites** tab → **+ Create Team Invite**, selecting **Team Administrator** role)
3. Send the invite link (or code/QR code) to the researcher
4. The researcher accepts the invite and signs in via SSO — this creates their account with the Team Administrator role
5. Optionally, add the **Content Creator** system role (Users → find user → **add** button in Roles column) so they can create {{notebooks}} outside their team

### Adding an Existing User to Your Team

1. Navigate to your team → **Users** tab → **+ Add user**
2. Enter their email and select the appropriate team role (e.g., **Team Member (Contributor)**)
3. They now have the corresponding virtual access to all your team's {{notebooks}}

Alternatively, create a team invite (Team → **Invites** tab → **+ Create Team Invite**) and share it with the user.

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
3. **Note**: You cannot revoke system roles — contact a system administrator (Super User or Operations Administrator)

---

## Roles Reference

### System-Wide Roles

| Role | Description | Typical User |
|------|-------------|--------------|
| General User | View assigned resources, manage own tokens | Rarely used alone |
| Content Creator | Create {{notebooks}} and templates globally | Researchers, project managers |
| Operations Administrator | Manage users, teams, and system operations (no data access) | IT operations staff |
| Super User | Full system control, all data access (emergency use) | IT administrators |

### Team Roles

| Role | Permissions | Virtual {{Notebook}} Role |
|------|-------------|----------------------|
| Team Administrator | Full team control | Administrator |
| Team Manager | Manage members, create {{notebooks}} | Manager |
| Team Member (Contributor) | Access team resources | Contributor |
| Team Member (Creator) | Create {{notebooks}} only | **None** (no access to other team {{notebooks}}) |

> ⚠️ **Key restriction**: Only Operations Administrator or Super User can assign Team Administrator role. Team Member (Creator) cannot see other team {{notebooks}} — they must be explicitly invited.

### {{Notebook}} Roles

| Role | Permissions |
|------|-------------|
| Project Admin | Full control, manage administrators |
| Project Manager | Edit design, close {{notebook}}, export, manage invites/access |
| Project Contributor | Edit others' records (plus all Guest permissions) |
| Project Guest | Activate {{notebook}}, create records, view/edit/delete own records |

### Permission Matrix — {{Notebooks}}

| Action | Guest | Contributor | Manager | Administrator |
|--------|:-----:|:-----------:|:-------:|:-------------:|
| Create records | ✅ | ✅ | ✅ | ✅ |
| View/edit/delete own records | ✅ | ✅ | ✅ | ✅ |
| View all records | ❌ | ✅ | ✅ | ✅ |
| Edit/delete others' records | ❌ | ✅ | ✅ | ✅ |
| Export own data | ✅ | ✅ | ✅ | ✅ |
| Export all {{notebook}} data | ❌ | ❌ | ✅ | ✅ |
| Edit {{notebook}} design | ❌ | ❌ | ✅ | ✅ |
| Close/reopen {{notebook}} | ❌ | ❌ | ✅ | ✅ |
| Reassign to different team | ❌ | ❌ | ✅ | ✅ |
| Manage invites and users | ❌ | ❌ | ✅ | ✅ |
| Manage administrators | ❌ | ❌ | ❌ | ✅ |

### Permission Matrix — Teams

| Action | Member | Member Creator | Manager | Admin |
|--------|:--------------------:|:----------------:|:-------:|:-------------:|
| View team details and members | ✅ | ✅ | ✅ | ✅ |
| View team templates | ✅ | ❌ | ✅ | ✅ |
| Access team {{notebooks}} (virtual role) | ✅ | ❌ | ✅ | ✅ |
| Create {{notebooks}} in team | ❌ | ✅ | ✅ | ✅ |
| Create templates in team | ❌ | ❌ | ✅ | ✅ |
| Edit team details | ❌ | ❌ | ✅ | ✅ |
| Add/remove team members | ❌ | ❌ | ✅ | ✅ |
| Manage team invites | ❌ | ❌ | ✅ | ✅ |
| Add/remove team managers | ❌ | ❌ | ❌ | ✅ |
| Add team admins | ❌ | ❌ | ❌ | Operations Administrator or Super User only |
| Delete team | ❌ | ❌ | ❌ | ✅ |

> ⚠️ **Note**: Team Member (Creator) can create {{notebooks}} but does NOT automatically get access to existing team {{notebooks}}. This is by design for teaching environments where students create isolated {{notebooks}}.
>
> Virtual roles: Team Member (Contributor) automatically receives **Contributor** access to team {{notebooks}}. Team Manager automatically receives **Manager** access. Team Administrator inherits Manager's virtual role. Team Member (Creator) receives **no** virtual {{notebook}} access.

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

**Cause**: Only Operations Administrator or Super User can assign Team Administrator roles.

**Solution**: Contact an Operations Administrator or Super User to assign the Team Administrator role.

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

- [Quickstart Guide](../authoring/quick-start-researchers.md) — Creating {{notebooks}} and collecting data

---

*Guide Version: 1.8*
*Last Updated: 2026-02-24*
