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

### What You Can Do As An Administrator

As IT or change management staff, you have been provisioned with administrative roles:

- **GENERAL_ADMIN** system role — full system control
- **Team Administrator** on relevant teams — full control over team membership and settings

This means you can:

- View and manage all system users and their roles
- Add or remove system roles (GENERAL_USER, GENERAL_CREATOR, GENERAL_ADMIN)
- Create and manage teams
- Assign Team Administrator roles (only GENERAL_ADMIN can do this)
- Manage all {{notebooks}} and their users

> 💡 **Note**: This guide assumes you have these administrative permissions. If you cannot perform an action described here, contact your system administrator to verify your role assignments.

### What Typical Users Can Do By Default

When users sign in via SSO, they are provisioned with:

- **GENERAL_CREATOR** system role — they can create {{notebooks}} and templates
- **Team Administrator** of their assigned team — they have full control over their team

This means they can immediately:

- Create {{notebooks}} (globally or within their team)
- Invite users to their team and assign team roles
- Invite users to {{notebooks}} they administer
- Manage access for their team members

> 💡 **Note**: Users do not create their own teams. Teams are created during provisioning, and users are assigned as Team Administrator of their team.

### The Three-Tier Permission Model

{{FAIMS}} uses a role-based permissions system to control access to different functions and data. The model centres around access to **resources**: teams, user accounts, templates, {{notebooks}}, and the system as a whole.

Roles are assigned at three levels:

| Level | Controls | Example Roles |
|-------|----------|---------------|
| **System** | What a user can create globally | GENERAL_USER, GENERAL_CREATOR, GENERAL_ADMIN |
| **Team** | Access within a team | Team Administrator, Team Manager, Team Member |
| **{{Notebook}}** | Access to specific {{notebooks}} | Administrator, Manager, Contributor, Guest |

### What All Users Can Do

Regardless of their assigned roles, all users in the system can:

- List {{notebooks}} they have access to
- List templates they have access to
- Create and revoke their own API access tokens

---

## Navigating the {{Dashboard}}

When you log in to the {{FAIMS}} {{Dashboard}}, you'll see a left sidebar with two sections:

### Content

- **{{Notebooks}}** — View and manage data collection {{notebooks}}
- **Templates** — View and manage reusable notebook templates

### Management

- **Users** — View all system users and their roles (requires appropriate permissions)
- **Teams** — View and manage teams

[SCREENSHOT: {{Dashboard}} sidebar showing Content ({{Notebooks}}, Templates) and Management (Users, Teams) sections]

> 💡 **Tip**: Click on any sidebar item to navigate to that section. The breadcrumb at the top (e.g., "Home > Users") shows your current location.

---

## Managing System Users

The **Users** section shows all users in the system with their email addresses and system-level roles.

### Viewing Users

1. Click **Users** in the left sidebar (under Management)
2. You'll see a table with columns:
   - **Name** — User's display name
   - **Email** — User's email address
   - **Roles** — System roles with "add" button and role badges
   - **Reset Password** — Password reset option
   - **Remove** — Remove user from system

[SCREENSHOT: Users list showing Name, Email, Roles columns with "add" button and "General User" badges]

### Understanding System Roles

| Role | Display | Description |
|------|---------|-------------|
| GENERAL_USER | General User | Basic access, view assigned resources |
| GENERAL_CREATOR | General Creator | Create {{notebooks}} and templates |
| GENERAL_ADMIN | General Admin | Full system control |

### Adding a Role to a User

1. Find the user in the Users list
2. In the **Roles** column, click the **add** button
3. Select the role to add from the dropdown
4. The new role badge appears next to any existing roles

[SCREENSHOT: Roles column showing "add" button and role selection dropdown]

### Removing a Role from a User

1. Find the user in the Users list
2. In the **Roles** column, locate the role badge you want to remove
3. Click the **×** in the upper-right corner of the role badge
4. The role is removed immediately

[SCREENSHOT: Role badge with × indicator for removal]

> ⚠️ **Warning**: Be careful when removing roles. If you remove GENERAL_CREATOR from a user, they will no longer be able to create new {{notebooks}}.

---

## Managing Teams

Teams group users together and provide shared access to {{notebooks}}. When you navigate to a team, you'll see several tabs.

### Viewing Your Team

1. Click **Teams** in the left sidebar
2. Click on your team name (teams you administer appear in the expanded sidebar)
3. You'll see tabs: **Details**, **Invites**, **{{Notebooks}}**, **Templates**, **Users**

[SCREENSHOT: Team view showing Details, Invites, {{Notebooks}}, Templates, Users tabs]

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

[SCREENSHOT: Team Users tab showing member list with role badges and red trash icons]

### Understanding Team Roles

| Role | Display | Permissions | Auto-grants on {{Notebooks}} |
|------|---------|-------------|--------------------------|
| TEAM_ADMIN | Team Administrator | Full team control | Administrator |
| TEAM_MANAGER | Team Manager | Manage members, create {{notebooks}} | Manager |
| TEAM_MEMBER | Team Member (Contributor) | Access team resources | Contributor |
| TEAM_MEMBER_CREATOR | Team Member (Creator) | Create {{notebooks}} only | **None** |

> ⚠️ **Important**: Team Member (Creator) can create {{notebooks}} but does NOT get automatic access to existing team {{notebooks}}.

### Adding a User to Your Team

1. Navigate to your team → **Users** tab
2. Click **+ Add user** button above the table
3. Enter the user's email address
4. Select their team role from the dropdown
5. Click **Add**

[SCREENSHOT: Add user dialog with email field and role dropdown]

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

[SCREENSHOT: Team member row with red trash icon highlighted]

> ⚠️ **Warning**: Removing someone from a team removes their automatic (virtual) access to ALL team {{notebooks}}. If they have direct notebook roles, those remain until separately removed.

---

## Managing {{Notebook}} Users

{{Notebooks}} have their own user management, separate from teams. Users can access {{notebooks}} either through team membership (virtual roles) or direct assignment.

### Viewing {{Notebook}} Users

1. Click **{{Notebooks}}** in the left sidebar
2. Click on a notebook name
3. Click the **Users** tab
4. You'll see a table with columns:
   - **Name** — User's display name
   - **Email** — User's email address
   - **{{Notebook}} Roles** — Current role (display only)
   - **Remove** — Trash icon to remove user

[SCREENSHOT: {{Notebook}} Users tab showing {{Notebook}} Roles column and Remove column]

### Understanding {{Notebook}} Roles

| Role | Display | Permissions |
|------|---------|-------------|
| PROJECT_ADMIN | Administrator | Full control, manage other admins, delete notebook |
| PROJECT_MANAGER | Manager | Edit design, close notebook, export, manage invites/access |
| PROJECT_CONTRIBUTOR | Contributor | Edit others' records (plus all Guest permissions) |
| PROJECT_GUEST | Guest | Activate notebook, create records, view/edit/delete own records |

### How {{Notebook}} Access Works

Users can have notebook access from two sources:

1. **Virtual roles** — Automatic access from team membership
2. **Direct roles** — Explicitly assigned to this notebook

| Team Role | Virtual {{Notebook}} Role |
|-----------|----------------------|
| Team Administrator | Administrator |
| Team Manager | Manager |
| Team Member (Contributor) | Contributor |
| Team Member (Creator) | **None** |

> 💡 **Note**: Direct roles override virtual roles. If a Team Member (Contributor) is directly assigned as Guest on a specific notebook, they have Guest access to that notebook.

### Inviting Users to a {{Notebook}}

Unlike Teams and Users, you **cannot change roles directly** in the notebook Users tab. To add users or change roles:

1. Navigate to your notebook
2. Click the **Invites** tab
3. Click **+ Invite user** (or similar button)
4. Enter the user's email address
5. Select their notebook role (Administrator, Manager, Contributor, or Guest)
6. Send the invitation

[SCREENSHOT: {{Notebook}} Invites tab with invite user dialog]

### Removing a User from a {{Notebook}}

1. Navigate to the notebook → **Users** tab
2. Find the user in the list
3. Click the **trash icon** in the Remove column
4. Confirm removal

> 💡 **Note**: Removing a direct role doesn't remove team membership. If the user has a team role, they'll still have virtual access through the team.

### Transferring {{Notebook}} Ownership

To hand off a notebook to someone else:

1. Go to the notebook → **Invites** tab
2. Invite the new owner with **Administrator** role
3. Once they accept, they have full control
4. Optionally remove yourself via the **Users** tab

> ⚠️ **Warning**: Always ensure at least one Administrator remains on every notebook.

---

## Quick Reference

### Role Hierarchy

```text
SYSTEM LEVEL
├── GENERAL_ADMIN ─────── Full system control (IT administrators)
├── GENERAL_CREATOR ───── Create {{notebooks}}/templates (default for SSO users)
└── GENERAL_USER ──────── Basic access only

TEAM LEVEL
├── Team Administrator ── Full team control, auto-grants Administrator on {{notebooks}}
├── Team Manager ──────── Manage team members, auto-grants Manager on {{notebooks}}
├── Team Member (Contributor) ── Access team resources, auto-grants Contributor
└── Team Member (Creator) ────── Create {{notebooks}} only, NO automatic notebook access

NOTEBOOK LEVEL
├── Administrator ─────── Full control, manage admins, delete notebook
├── Manager ───────────── Edit design, close, export, manage invites/access
├── Contributor ───────── Edit others' records (plus Guest permissions)
└── Guest ─────────────── Activate, create records, view/edit/delete own records
```

### When to Use Each Role

| Scenario | Recommended Role |
|----------|------------------|
| Project lead who manages everything | Team Administrator + notebook Administrator |
| Researcher who designs forms | Team Manager or notebook Manager |
| Field worker collecting data | Team Member (Contributor) or notebook Contributor |
| External reviewer (limited access) | {{Notebook}} Guest |
| Someone who creates {{notebooks}} but shouldn't see others' data | Team Member (Creator) |

### UI Patterns Summary

| Location | How to Add | How to Remove |
|----------|------------|---------------|
| **Users** (system) | Click "add" button in Roles column | Click × on role badge |
| **Teams → Users** | Click "+ Add user" or "+" on existing member | Click × on role badge, or trash icon to remove from team |
| **{{Notebooks}} → Users** | Go to **Invites** tab to invite with role | Click trash icon in Remove column |

---

## Common Scenarios

### Onboarding a New Staff Member

1. They sign in via SSO (automatically get GENERAL_CREATOR + their own team)
2. Navigate to your team → **Users** tab → **+ Add user**
3. Enter their email and select **Team Member (Contributor)**
4. They now have Contributor access to all your team's {{notebooks}}

### Setting Up a Project Team

1. Create notebook(s) for the project ({{Notebooks}} → Create {{Notebook}})
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

1. Go to the specific notebook → **Invites** tab
2. Invite them with Contributor or Guest role
3. They don't need team membership

### Handing Off a Project

1. {{Notebook}} → **Invites** tab → Invite colleague as **Administrator**
2. Verify they can access and manage the notebook
3. Optionally remove yourself from the Users tab

### Off-boarding: Removing All Access

1. **Remove from {{notebooks}}** (if they have direct roles):
   - Navigate to each notebook → Users tab → trash icon
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
| TEAM_MEMBER_CREATOR | Team Member (Creator) | Create {{notebooks}} only | **None** |

> ⚠️ **Key restriction**: Only GENERAL_ADMIN can assign Team Administrator role.

### {{Notebook}} Roles

| Role | Display Name | Permissions |
|------|--------------|-------------|
| PROJECT_ADMIN | Administrator | Full control, manage administrators, delete notebook |
| PROJECT_MANAGER | Manager | Edit design, close notebook, reassign team, export, manage invites/access |
| PROJECT_CONTRIBUTOR | Contributor | Edit others' records (plus all Guest permissions) |
| PROJECT_GUEST | Guest | Activate notebook, create records, view/edit/delete own records |

### Template Roles

| Role | Display Name | Permissions |
|------|--------------|-------------|
| TEMPLATE_ADMIN | Administrator | Update template details, archive template |
| TEMPLATE_GUEST | Guest | View template |

> 💡 **Note**: Template roles are primarily managed through team membership. Team Administrators act as template administrators for team templates.

### Permission Matrix — {{Notebooks}}

| Action | Guest | Contributor | Manager | Administrator |
|--------|:-----:|:-----------:|:-------:|:-------------:|
| Activate notebook | ✅ | ✅ | ✅ | ✅ |
| Create records | ✅ | ✅ | ✅ | ✅ |
| View/edit/delete own records | ✅ | ✅ | ✅ | ✅ |
| Edit others' records | ❌ | ✅ | ✅ | ✅ |
| Update notebook metadata/design | ❌ | ❌ | ✅ | ✅ |
| Close notebook | ❌ | ❌ | ✅ | ✅ |
| Reassign to different team | ❌ | ❌ | ✅ | ✅ |
| Export data | ❌ | ❌ | ✅ | ✅ |
| Manage invites and access | ❌ | ❌ | ✅ | ✅ |
| Manage administrators | ❌ | ❌ | ❌ | ✅ |
| Delete notebook | ❌ | ❌ | ❌ | ✅ |

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
| Act as notebook manager (virtual role) | ❌ | ❌ | ✅ | ✅ |
| Add/remove team managers | ❌ | ❌ | ❌ | ✅ |
| Act as notebook/template administrator | ❌ | ❌ | ❌ | ✅ |

> ⚠️ **Note**: Team Member (Creator) can create {{notebooks}} but does NOT automatically get access to existing team {{notebooks}}. This is by design for teaching environments where students create isolated {{notebooks}}.

---

## Troubleshooting

### Can't See a {{Notebook}}

**Possible causes**:

- Not a member of the team that owns the notebook
- Team role is Team Member (Creator) — doesn't grant automatic access
- Not directly invited to the notebook

**Solution**: Check team membership and role. Add direct notebook access via Invites tab if needed.

### Can't Edit {{Notebook}} Structure

**Cause**: Missing Manager or Administrator role on the notebook.

**Solution**: Have a notebook Administrator invite you with Manager or Administrator role.

### Can't Add Users to Team

**Cause**: Missing Team Manager or Team Administrator role.

**Solution**: Have a Team Administrator elevate your team role.

### Can't Assign Team Administrator Role

**Cause**: Only GENERAL_ADMIN can assign Team Administrator roles.

**Solution**: Contact your system administrator.

### User Has Access But Shouldn't

**Cause**: User may have both direct and virtual (team-based) roles.

**Solution**: Check both:

1. Direct notebook roles ({{Notebook}} → Users tab)
2. Team membership (Team → Users tab)

Remove from both locations if needed.

### Can't Change a User's {{Notebook}} Role

**Note**: The {{Notebook}} Users tab only displays roles — you cannot edit them there.

**Solution**: Remove the user (trash icon), then re-invite via the **Invites** tab with the new role.

---

## Further Resources

- [Quickstart Guide](./quickstart-creation-and-collection.md) — Creating {{notebooks}} and collecting data

---

*Guide Version: 1.2*
*Last Updated: 2026-01-13*
