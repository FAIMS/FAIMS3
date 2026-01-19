# User Roles and Permissions Guide (Task-Organised)

*This guide is organised by common tasks you need to perform, not by system components. Use the task index below to find exactly what you need to do.*

---

## 1. Quick Start

### 1.1 Task Index

| I want to... | See |
|--------------|-----|
| Add someone to my team | [Onboarding a New Staff Member](#21-onboarding-a-new-staff-member) |
| Remove someone's access entirely | [Off-boarding: Removing All Access](#22-off-boarding-removing-all-access) |
| Give someone admin access to a {{notebook}} | [Changing Someone's Role](#26-changing-someones-role) |
| Let an external collaborator into one {{notebook}} | [Granting External Collaborator Access](#25-granting-external-collaborator-access) |
| Hand off a project to a colleague | [Handing Off a Project](#27-handing-off-a-project) |
| Start a new project with {{notebooks}} and team members | [Starting a New Project](#23-starting-a-new-project) |
| Create a new team | [Creating a Team](#24-creating-a-team) |
| Figure out why someone can't see a {{notebook}} | [Troubleshooting: Can't See a {{Notebook}}](#61-cant-see-a-{{notebook}}) |
| Understand what roles exist | [Reference: Role Definitions](#51-role-definitions) |

### 1.2 Role Hierarchy Diagram

The diagram below shows roles at each of the three levels (System, Team, {{Notebook}}) and how team roles automatically grant corresponding {{notebook}} access through virtual role inheritance. Note that Team Member (Creator) does not automatically gain access to team {{notebooks}} — they must be explicitly invited.

```{image} ../../inputs/diagrams/images/permissions-hierarchy.png
:alt: {{FAIMS}} Permissions Hierarchy Diagram showing three tiers: System Level (General Admin with full system control, General Creator for {{notebooks}} and templates, General User for basic access), Team Level (Team Administrator, Team Manager, Team Member Contributor, Team Member Creator with warning that Creator gets no automatic {{notebook}} access), and {{Notebook}} Level (Administrator, Manager, Contributor, Guest). Arrows indicate virtual role inheritance from team to {{notebook}} roles. A sidebar shows the inheritance mapping: Team Administrator grants Administrator, Team Manager grants Manager, Team Member Contributor grants Contributor, Team Member Creator grants none.
```

### 1.3 Key Concept: Virtual vs. Direct Access

Understanding virtual and direct access is essential for troubleshooting unexpected permission behaviour.

**Virtual roles** are automatically granted through team membership. When you add someone to a team, they immediately gain access to all {{notebooks}} owned by that team. The access level depends on their team role:

| Team Role | Virtual {{Notebook}} Role |
|-----------|----------------------|
| Team Administrator | Administrator |
| Team Manager | Manager |
| Team Member (Contributor) | Contributor |
| Team Member (Creator) | **None** (can create {{notebooks}} but doesn't automatically access existing ones) |

**Direct roles** are explicitly assigned to a specific {{notebook}} through the Invites tab. A user can have a direct role on a {{notebook}} regardless of their team membership.

**Direct roles override virtual roles.** If someone has a virtual Contributor role from team membership but you invite them directly as a Manager, they'll have Manager permissions on that {{notebook}}.

> **Tip:** When someone reports unexpected access (too much or too little), check both their team membership AND their direct {{notebook}} roles.

### 1.4 UI Patterns Summary

| Location | How to Add User | How to Add Role | How to Change Role | How to Remove |
|----------|-----------------|-----------------|-------------------|---------------|
| **Users** (system) | N/A (provisioned via Single Sign-On) | Click "add" button in Roles column | Click × on role badge, then add new role | Click × on role badge (removes role only) |
| **Teams → Users** | Click "+ Add user" or go to **Invites** tab | Click "+" on existing member's row | Click × on role badge, then add new role | Click × on role badge (removes role only), or trash icon (removes user from team) |
| **{{Notebooks}} → Users** | Go to **Invites** tab | N/A (one role per user) | Remove user, then re-invite with desired role | Click trash icon (removes user from {{notebook}}) |

---

## 2. Common Tasks

### 2.1 Onboarding a New Staff Member

**When to use**: A new team member has joined and needs access to your team's {{notebooks}}.

**What happens automatically**: When users sign in via Single Sign-On (SSO) for the first time, they are automatically provisioned with:

- **GENERAL_CREATOR** system role — they can create {{notebooks}} and templates
- **Team Administrator** of their own assigned team — they have full control over their team

This means they can immediately create {{notebooks}}, but they won't have access to *your* team's resources until you add them.

**Steps to add them to your team:**

1. Click **Teams** in the left sidebar
2. Click on your team name
3. Click the **Users** tab
4. Click **+ Add user** (to the right of the Filter field)
5. Enter their email address
6. Select the appropriate role:
   - **Team Member (Contributor)** — for field workers who collect data (most common)
   - **Team Member (Creator)** — for users who should create {{notebooks}} but not see others' data
   - **Team Manager** — for researchers who design forms and manage data
   - **Team Administrator** — for team leaders (requires GENERAL_ADMIN to assign)
7. Click **Add** (in the dialog)

The new team member will immediately have virtual access to all team {{notebooks}} based on their role (see [Virtual vs. Direct Access](#13-key-concept-virtual-vs-direct-access)).

> **Note:** If you need to assign the Team Administrator role, you must have GENERAL_ADMIN permissions. Regular Team Administrators cannot elevate others to their level.

**See also:** [Troubleshooting: Can't See a {{Notebook}}](#61-cant-see-a-{{notebook}})

---

### 2.2 Off-boarding: Removing All Access

**When to use**: A team member is leaving and their access needs to be revoked.

**Important**: Virtual and direct access must be handled separately.

**Steps:**

1. **Remove direct {{notebook}} roles first** (if any exist):
   - Navigate to each {{notebook}} where they have a direct role
   - Click the **Users** tab
   - Find the user and click the trash icon (far right, in the **Remove** column)

2. **Remove from team:**
   - Click **Teams** in the left sidebar
   - Click on the team name
   - Click the **Users** tab
   - Find the user and click the trash icon (far right) to remove them from the team

3. **System roles (if needed):**
   - System roles (GENERAL_USER, GENERAL_CREATOR, GENERAL_ADMIN) cannot be removed by team administrators
   - Contact a GENERAL_ADMIN if system role removal is required

> **Warning**: Removing someone from a team removes their virtual access to all team {{notebooks}}. However, if they have direct roles on any {{notebooks}}, those must be removed separately.

**See also:** [Troubleshooting: User Has Access But Shouldn't](#65-user-has-access-but-shouldnt)

---

### 2.3 Starting a New Project

**When to use**: Starting a new research project that needs dedicated {{notebooks}} and team members.

**Prerequisites**: You need an existing team (see [Creating a Team](#24-creating-a-team) if you need one).

**Steps:**

1. **Navigate to your team:**
   - Click **Teams** in the left sidebar
   - Click on your team name

2. **Add team members** (Users tab):
   - Click the **Users** tab
   - Click **+ Add user** (to the right of the Filter field)
   - Add each team member with the appropriate role:

| Person Type | Recommended Role |
|-------------|------------------|
| Project lead | Team Administrator (requires GENERAL_ADMIN) or Team Manager |
| Researchers designing forms | Team Manager |
| Field workers collecting data | Team Member (Contributor) |
| Users who create {{notebooks}} but shouldn't see others' data | Team Member (Creator) |

3. **Create the project {{notebook}}(s)** ({{Notebooks}} tab):
   - Click the **{{Notebooks}}** tab
   - Click **+ Create {{Notebook}}**
   - Enter the {{notebook}} name and select a template (or upload JSON)
   - Click **Create**
   - The {{notebook}} is automatically owned by the team — no manual association needed

4. **Verify access:**
   - Ask team members to log in and confirm they can see the project {{notebooks}}

**See also:** [Creating a Team](#24-creating-a-team)

---

### 2.4 Creating a Team

**When to use**: You need a new organisational unit for a project, department, or collaboration group.

**Prerequisite**: Only users with **GENERAL_ADMIN** system role can create new teams.

**Steps:**

1. Click **Teams** in the left sidebar
2. Click **+ Create Team** (to the right of the Filter field)
3. Enter the team details:
   - **Name** — A descriptive name (e.g., "Pilbara Survey 2026")
   - **Description** — Optional description of the team's purpose
4. Click **Create team** (at the bottom of the dialog)

```{screenshot} user-roles/08-teams-create-dialog.png
:alt: Create Team dialog showing Name field and Description field with Create team button
:align: right
```

5. The new team appears in the Teams list with you as the creator

**After creating the team:**

- You are automatically assigned as Team Administrator
- Add team members using the **Users** tab
- Create {{notebooks}} from the **{{Notebooks}}** tab (they'll automatically be owned by the team)

> **Note:** Most teams are created during initial provisioning. You'll usually be managing existing teams rather than creating new ones.

---

### 2.5 Granting External Collaborator Access

**When to use**: You need to give an external collaborator (visitor, contractor, partner institution) access to your project.

**Choose your approach:**

| Approach | When to Use | Effect |
|----------|-------------|--------|
| **Invite to team** | Ongoing collaboration with multiple {{notebooks}} | Access to ALL current and future team {{notebooks}} |
| **Invite to {{notebook}}** | One-time or limited access | Access to specific {{notebook}}(s) only |

**Option A: Invite to team (ongoing access to team {{notebooks}})**

1. Click **Teams** → your team name → **Invites** tab
2. Click **+ Create Team Invite** (to the right of the Filter field)
3. In the dialog:
   - Enter an **Invite title** (e.g., "Contractor access 2026")
   - Select the **Role** (Team Member Contributor is appropriate for most external collaborators)
   - Set **Maximum uses** (leave empty for unlimited)
   - Set **Invite Duration** using Quick Select or Custom Date
4. Click **Create Invite**

The invite appears in the Invites tab with a code, link, and QR code that you can share with the collaborator.

> **Tip:** If you already know their email and they're registered in the system, you can add them directly via the **Users** tab → **+ Add user** instead.

Note that Team Member (Creator) does not grant automatic access to team {{notebooks}} (other team roles do).

**Option B: Invite to specific {{notebook}} (scope limited to the {{notebook}})**

If the {{notebook}} belongs to a team, the easiest path is:

1. Click **Teams** → your team name → **{{Notebooks}}** tab
2. Click on the {{notebook}} name
3. Click the **Invites** tab
4. Click **+ Create Invite** (to the right of the Filter field)
5. In the dialog:
   - Enter an **Invite title** (e.g., "External reviewer access")
   - Select the **Role** (Guest is usually appropriate for external reviewers)
   - Set **Maximum uses** (leave empty for unlimited)
   - Set **Invite Duration** using Quick Select or Custom Date
6. Click **Create Invite**

The invite appears in the Invites tab with a code, link, and QR code that you can share with the collaborator.

Alternatively, navigate via **{{Notebooks}}** in the left sidebar if you're not already in the team context.

**Guidance on when to use each:**

- Use **team invite** when the collaborator needs template access (templates are only available through team membership)
- Use **{{notebook}} invite** when you want to limit what they can see
- Use **{{notebook}} invite with Guest role** for external reviewers who should only see their own records

**See also:** [Managing Invites](#28-managing-invites)

---

### 2.6 Changing Someone's Role

**When to use**: A team member needs different permissions (e.g., promotion to manager, temporary elevation for a task).

**Important asymmetry**: Team roles and {{notebook}} roles are managed differently.

**Changing team roles:**

1. Click **Teams** → your team name → **Users** tab
2. Find the user
3. In the **Roles** column, click **+** (next to the role badges) to add a role, or click the small **×** on a role badge to remove it
4. Changes take effect immediately

**Changing {{notebook}} roles:**

{{Notebook}} roles cannot be edited. You must remove and re-invite:

1. Click **{{Notebooks}}** → the specific {{notebook}}
2. Click the **Users** tab
3. Find the user and click the trash icon (far right) to remove their direct role
4. Click the **Invites** tab
5. Click **+ Create Invite** (to the right of the Filter field) and select the desired role
6. Provide the user with the code, link, or QR code generated by the invitation

> **Note:** If the user has virtual access from team membership, removing their direct role doesn't remove their access — they'll fall back to their virtual role.

**See also:** [Troubleshooting: Can't Change a User's {{Notebook}} Role](#66-cant-change-a-users-{{notebook}}-role)

---

### 2.7 Handing Off a Project

**When to use**: You're transferring responsibility for a project to a colleague (e.g., changing project leads, staff transition).

**Choose your approach:**

| Approach | When to Use | Effect |
|----------|-------------|--------|
| **Hand off team** | Transferring overall project leadership | New leader gains control of team AND all team {{notebooks}} |
| **Hand off {{notebook}}** | Transferring a single {{notebook}} only | New leader gains control of specific {{notebook}} only |

**Option A: Hand off team (recommended for most cases)**

This transfers leadership of the team and all its {{notebooks}} in one step.

**Prerequisite**: Only users with **GENERAL_ADMIN** can assign the Team Administrator role. If you don't have this permission, request a GENERAL_ADMIN to perform the handover.

1. **Add colleague as Team Administrator:**
   - Click **Teams** → your team name → **Users** tab
   - Click **+ Add user** (to the right of the Filter field)
   - Enter their email address
   - Select **Team Administrator** role
   - Click **Add**

2. **Verify they can access and manage:**
   - Ask them to log in
   - Confirm they can see the team and its {{notebooks}}
   - Have them verify they can access the Users tab and add/remove members

3. **Optionally remove yourself:**
   - Once confirmed, you can remove your own Team Administrator role if you no longer need it
   - Go to the team's **Users** tab → find your entry → click the small **×** on your Team Administrator role badge

> **Tip:** If you prefer not to share their email directly, you can create a single-use invite instead: go to the **Invites** tab → **+ Create Team Invite** → select **Team Administrator** role → set **Maximum uses** to 1 and a short **Invite Duration** (e.g., 24 hours).

> **Warning**: Never remove yourself before confirming the new Team Administrator has access and can manage the team. Ensure at least one Team Administrator remains.

**Option B: Hand off specific {{notebook}} only**

Use this when transferring a single {{notebook}} while keeping team structure intact, or when the new owner shouldn't join the team.

1. **Invite colleague as Administrator:**
   - Click **{{Notebooks}}** → the {{notebook}}
   - Click the **Invites** tab
   - Click **+ Create Invite** (to the right of the Filter field)
   - Select **Administrator** role
   - Provide the user with the code, link, or QR code generated by the invitation
   - Wait for them to accept

2. **Verify they can access and manage:**
   - Ask them to log in
   - Confirm they can see the {{notebook}}
   - Have them verify they can access the Users tab and create invites

3. **Optionally remove yourself:**
   - Once confirmed, you can remove your own role if you no longer need access
   - Go to the {{notebook}}'s **Users** tab → find your entry → click the trash icon (far right)

> **Warning**: Never remove yourself before confirming the new Administrator has access. If you remove the last Administrator, no one can manage the {{notebook}}.

---

### 2.8 Managing Invites

**When to use**: Creating, tracking, or deleting pending invitations to teams or {{notebooks}}.

**How invites work:**

- **Expiry**: Invites can have an expiration date after which they can no longer be used
- **Uses remaining**: You can limit how many times an invite code can be used
- **Sharing methods**: Once created, the system generates a Code, Link, and QR Code — share these with invitees via email, message, or in person

**Creating team invites:**

1. Click **Teams** → your team name → **Invites** tab
2. Click **+ Create Team Invite** (to the right of the Filter field)
3. Configure:
   - **Role**: What team role will invitees receive
   - **Expiry**: When the invite becomes invalid
   - **Uses**: How many people can use this invite (leave empty for unlimited)
4. Click **Create Invite** (at the bottom of the dialog)
5. Share the generated code, link, or QR code with the invitee

```{screenshot} user-roles/08b-teams-create-invite.png
:alt: Create Team Invite dialog showing Role dropdown with team roles, Expiry date field, and Create Invite button
:align: right
```

Once created, the invite appears in the Invites tab:

```{screenshot} user-roles/08a-teams-invites-tab.png
:alt: Team Invites tab showing list of pending invitations with columns for Name, Role, Expiry, Uses remaining, Code, Link, QR Code, and Remove
:align: right
```

**Creating {{notebook}} invites:**

1. Click **{{Notebooks}}** → the {{notebook}} → **Invites** tab
2. Click **+ Create Invite** (to the right of the Filter field)
3. Configure options (same as team invites, but for {{notebook}} roles)
4. Click **Create Invite** (at the bottom of the dialog)

```{screenshot} user-roles/10-notebooks-invite.png
:alt: Create Invite dialog for a {{notebook}} showing Invite title field, Role dropdown with options (Administrator, Manager, Contributor, Guest), expiry date selection with Quick Select and Custom Date options, and Create Invite button
:align: right
```

**Managing pending invites:**

- View pending invites in the **Invites** tab
- Copy the **Code** or **Link** to share again if needed
- Click the **QR Code** icon to display it for scanning
- Click the red trash icon to **Remove** invites that are no longer needed
- Monitor **Uses remaining** to see how many times an invite can still be used

---

## 3. How the System Works

### 3.1 The Three-Tier Permission Model

{{FAIMS}} uses a role-based permissions system with three levels:

| Level | Controls | Example Roles |
|-------|----------|---------------|
| **System** | What a user can create globally | GENERAL_USER, GENERAL_CREATOR, GENERAL_ADMIN |
| **Team** | Access within a team | Team Administrator, Team Manager, Team Member |
| **{{Notebook}}** | Access to specific {{notebooks}} | Administrator, Manager, Contributor, Guest |

Each level is independent but interacts:

- System roles determine what users can create and modify (teams, {{notebooks}}, templates)
- Team roles provide virtual access to team resources ({{notebooks}}, templates)
- {{Notebook}} roles provide direct access to specific {{notebooks}}

### 3.2 What You Can Do As An Administrator

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

### 3.3 What Typical Enterprise Users Can Do By Default

When enterprise users sign in via SSO, they are provisioned with:

- **GENERAL_CREATOR** system role — they can create {{notebooks}} and templates
- **Team Administrator** of their assigned team — they have full control over their team

This means they can immediately:

- Create {{notebooks}} (stand-alone or within their team)
- Invite users to their team and assign team roles
- Invite users to {{notebooks}} they administer and assign {{notebook}} roles
- Manage and update roles for their team members

> **Note:** Users do not have the necessary privileges to create their own teams. Teams are typically created during initial provisioning or by a GENERAL_ADMIN, and users are assigned as Team Administrator of their team.

### 3.4 How Users Are Created

In an enterprise deployment, users are automatically created when they first sign in via SSO. You cannot manually create user accounts through the {{Dashboard}}. When a user signs in for the first time, they are provisioned with default roles (see "What Typical Enterprise Users Can Do By Default" above).

### 3.5 What This Guide Doesn't Cover

This guide focuses on user, team, and {{notebook}} management. It does **not** cover:

- **Template creation/management** — see technical documentation
- **{{Notebook}} design and form building** — see [Quickstart Guide](./quickstart-creation-and-collection.md)
- **Data collection and record management** — see [Quickstart Guide](./quickstart-creation-and-collection.md)
- **System configuration and SSO setup** — contact your system administrator
- **API tokens** — see technical documentation

---

## 4. Detailed Procedures

### 4.1 System User Management

#### Viewing Users

1. Click **Users** in the left sidebar (under Management)
2. You'll see a table with columns:
   - **Name** — User's display name
   - **Email** — User's email address
   - **Roles** — System roles with "add" button and role badges
   - **Reset Password** — Not applicable for SSO deployments; password management is handled through your institution's identity provider
   - **Remove** — Remove user from system

#### Understanding System Roles

| Role | Display Name | Description | Typical User |
|------|--------------|-------------|--------------|
| GENERAL_USER | General User | View assigned resources | Rarely used alone |
| GENERAL_CREATOR | General Creator | Create {{notebooks}} and templates globally | Researchers, project managers |
| GENERAL_ADMIN | General Admin | Full system control, manage all users | IT administrators |

#### Adding a Role to a User

1. Find the user in the Users list
2. In the **Roles** column, click **add** (next to the role badges)
3. Select the role to add from the dropdown
4. The new role badge appears next to any existing roles

#### Removing a Role from a User

1. Find the user in the Users list
2. In the **Roles** column, locate the role badge you want to remove
3. Click the **×** in the upper-right corner of the role badge
4. The role is removed immediately

> **Warning**: Be careful when removing roles. If you remove GENERAL_CREATOR from a user, they will no longer be able to create {{notebooks}} globally. However, they can still create {{notebooks}} within teams where they have the Team Member (Creator), Team Manager, or Team Administrator role.

### 4.2 Team Management

#### Viewing Your Team

1. Click **Teams** in the left sidebar
2. Click on your team name
3. You'll see tabs: **Details**, **Invites**, **{{Notebooks}}**, **Templates**, **Users**

#### Team Tabs Overview

| Tab | Purpose |
|-----|---------|
| **Details** | View and edit team name and description |
| **Invites** | Create and manage team membership invitations |
| **{{Notebooks}}** | View all {{notebooks}} owned by this team |
| **Templates** | View all templates owned by this team |
| **Users** | Add, remove, and manage team members |

#### Understanding Team Roles

| Role | Display Name | Permissions | Virtual {{Notebook}} Role |
|------|--------------|-------------|----------------------|
| TEAM_ADMIN | Team Administrator | Full team control | Administrator |
| TEAM_MANAGER | Team Manager | Manage members, create {{notebooks}} | Manager |
| TEAM_MEMBER | Team Member (Contributor) | Access team resources | Contributor |
| TEAM_MEMBER_CREATOR | Team Member (Creator) | Create {{notebooks}} only | **None** (no access to other team {{notebooks}}) |

> **Note**: Team Member (Creator) is a special role for users who need to create {{notebooks}} but should not automatically see other {{notebooks}} in the team. They must be explicitly invited to each {{notebook}} they need to access.

#### Directly Adding a User to Your Team (no invite)

Use this method when you know the user's email address and want to add them immediately.

1. Navigate to **Teams** → your team name → **Users** tab
2. Click **+ Add user** (to the right of the Filter field)
3. Enter the user's email address
4. Select the appropriate role
5. Click **Add** (in the dialog)

The user appears in the team immediately. If they haven't signed in before, an account is created for them.

#### Adding a User to Your Team via Invite

Use this method when you want to share a link or code that users can redeem themselves.

1. Click **Teams** → your team name → **Invites** tab
2. Click **+ Create Team Invite** (to the right of the Filter field)
3. Select the team role to grant
4. Set expiry and maximum uses
5. Click **Create Invite** (at the bottom of the dialog)
6. Share the generated code, link, or QR code with the invitee

> **Tip:** For one-time invites, set **Maximum uses** to 1. For workshops or training, use unlimited uses with a longer expiry.

#### Adding a Role to an Existing Team Member

1. Navigate to **Teams** → your team name → **Users** tab
2. Find the team member
3. In the **Roles** column, click **+** (next to the role badges)
4. Select the role to add
5. The role is added immediately

#### Removing a Role from a Team Member

1. Navigate to **Teams** → your team name → **Users** tab
2. Find the team member
3. Click the small **×** on the role badge you want to remove
4. The role is removed immediately

#### Removing a Member from Your Team

1. Navigate to **Teams** → your team name → **Users** tab
2. Find the team member
3. Click the trash icon (far right, in the **Remove** column)
4. Confirm the removal
5. The user loses virtual access to all team {{notebooks}}

#### Transferring Team Ownership

To transfer a team to a new owner:

1. Add the new owner as **Team Administrator** (see "Adding a User to Your Team via Invite" or "Directly Adding a User to Your Team")
2. Wait for them to accept and verify access
3. Optionally remove yourself if you no longer need access

> **Warning**: Ensure at least one Team Administrator remains before removing yourself. Only GENERAL_ADMIN can assign the Team Administrator role, so if you remove yourself, you'll need a system administrator to restore your access.

#### Managing Team Invites

To view and manage existing invites:

1. Navigate to **Teams** → your team name → **Invites** tab
2. View all pending invitations with their expiry dates and remaining uses
3. Copy invite links or codes to reshare
4. Click the trash icon to cancel an invite

To create new invites, see [Adding a User to Your Team via Invite](#adding-a-user-to-your-team-via-invite) above.

### 4.3 {{Notebook}} User Management

#### Viewing {{Notebook}} Users

1. Click **{{Notebooks}}** in the left sidebar
2. Click on the {{notebook}} name
3. Click the **Users** tab
4. You'll see a list of users with their roles

The Users tab shows two types of access:

- **Direct roles** — Users invited directly to this {{notebook}}
- **Virtual roles** — Users with access through team membership (shown with team indicator)

#### Understanding {{Notebook}} Roles

| Role | Display Name | Permissions |
|------|--------------|-------------|
| PROJECT_ADMIN | Administrator | Full control, manage administrators, delete {{notebook}} |
| PROJECT_MANAGER | Manager | Edit design, close {{notebook}}, reassign team, export, manage invites/access |
| PROJECT_CONTRIBUTOR | Contributor | Edit others' records (plus all Guest permissions) |
| PROJECT_GUEST | Guest | Activate {{notebook}}, create records, view/edit/delete own records |

#### How {{Notebook}} Access Works

Users can access a {{notebook}} through:

1. **Direct role** — Explicitly invited to the {{notebook}}
2. **Virtual role** — Team membership grants automatic access
3. **GENERAL_ADMIN** — System administrators have implicit access to all {{notebooks}}

**Precedence**: Direct roles override virtual roles.

#### Inviting Users to a {{Notebook}}

1. Click **{{Notebooks}}** → the {{notebook}} → **Invites** tab
2. Click **+ Create Invite** (to the right of the Filter field)
3. Select the role to grant
4. Set expiry and maximum uses
5. Click **Create Invite** (at the bottom of the dialog)
6. Share the generated code, link, or QR code with the invitee

#### Removing a User from a {{Notebook}}

1. Click **{{Notebooks}}** → the {{notebook}} → **Users** tab
2. Find the user
3. Click the trash icon (far right, in the **Remove** column)
4. Confirm the removal

> **Note:** This only removes direct roles. If the user has virtual access through team membership, they'll retain that access. Remove them from the team to fully revoke access.

#### Transferring {{Notebook}} Ownership

To transfer a {{notebook}} to a new owner:

1. Invite the new owner as **Administrator** (see "Inviting Users to a {{Notebook}}")
2. Wait for them to accept and verify access
3. Optionally remove yourself if you no longer need access

> **Warning**: Ensure at least one Administrator remains before removing yourself.

---

## 5. Reference

### 5.1 Role Definitions

#### System-Wide Roles

| Role | Display Name | Description | Typical User |
|------|--------------|-------------|--------------|
| GENERAL_USER | General User | View assigned resources, manage own tokens | Rarely used alone |
| GENERAL_CREATOR | General Creator | Create {{notebooks}} and templates globally | Researchers, project managers |
| GENERAL_ADMIN | General Admin | Full system control, manage all users | IT administrators |

#### Team Roles

| Role | Display Name | Permissions | Virtual {{Notebook}} Role |
|------|--------------|-------------|----------------------|
| TEAM_ADMIN | Team Administrator | Full team control | Administrator |
| TEAM_MANAGER | Team Manager | Manage members, create {{notebooks}} | Manager |
| TEAM_MEMBER | Team Member (Contributor) | Access team resources | Contributor |
| TEAM_MEMBER_CREATOR | Team Member (Creator) | Create {{notebooks}} only | **None** (no access to other team {{notebooks}}) |

> **Key restriction**: Only GENERAL_ADMIN can assign Team Administrator role. Team Member (Creator) cannot see other team {{notebooks}} — they must be explicitly invited.

#### {{Notebook}} Roles

| Role | Display Name | Permissions |
|------|--------------|-------------|
| PROJECT_ADMIN | Administrator | Full control, manage administrators, delete {{notebook}} |
| PROJECT_MANAGER | Manager | Edit design, close {{notebook}}, reassign team, export, manage invites/access |
| PROJECT_CONTRIBUTOR | Contributor | Edit others' records (plus all Guest permissions) |
| PROJECT_GUEST | Guest | Activate {{notebook}}, create records, view/edit/delete own records |

### 5.2 When to Use Each Role

| Scenario | Recommended Role |
|----------|------------------|
| Project lead who manages everything | Team Administrator + {{notebook}} Administrator |
| Researcher who designs forms | Team Manager or {{notebook}} Manager |
| Field worker collecting data | Team Member (Contributor) or {{notebook}} Contributor |
| External reviewer (limited access) | {{Notebook}} Guest |
| Someone who creates {{notebooks}} but shouldn't see others' data | Team Member (Creator) |
| Temporary access for one task | {{Notebook}} Guest or Contributor (with expiring invite) |

### 5.3 Permission Matrix — {{Notebooks}}

| Action | Guest | Contributor | Manager | Administrator |
|--------|:-----:|:-----------:|:-------:|:-------------:|
| View/edit/delete own records | | | | |
| Create records | | | | |
| View all records | | | | |
| Edit others' records | | | | |
| Export own data | | | | |
| Export all {{notebook}} data | | | | |
| Edit {{notebook}} design | | | | |
| Close/reopen {{notebook}} | | | | |
| Reassign to different team | | | | |
| Manage invites/users | | | | |
| Manage administrators | | | | |
| Delete {{notebook}} | | | | |

### 5.4 Permission Matrix — Teams

| Action | Member (Contributor) | Member (Creator) | Manager | Administrator |
|--------|:--------------------:|:----------------:|:-------:|:-------------:|
| View team details | | | | |
| View team templates | | | | |
| Access team {{notebooks}} (virtual role) | | | | |
| Create {{notebooks}} in team | | | | |
| Create templates in team | | | | |
| Add/remove team members | | | | |
| Add/remove team managers | | | | |
| Add team administrators | | | | GENERAL_ADMIN only |
| Edit team details | | | | |
| Delete team | | | | |

> **Note**: Team Member (Creator) can create {{notebooks}} but does NOT automatically get access to existing team {{notebooks}}. This is by design for teaching environments where students create isolated {{notebooks}}.

---

## 6. Troubleshooting

### 6.1 Can't See a {{Notebook}}

**Possible causes:**

- Not invited to the {{notebook}}
- Not a member of the team that owns the {{notebook}}
- Team membership doesn't grant automatic access (Team Member Creator role)

**Solution:**

1. Check if the user is a member of the {{notebook}}'s owning team
2. If in team, check their team role — Team Member (Creator) doesn't grant automatic access
3. If not in team, invite them directly to the {{notebook}} via the Invites tab
4. If they should have access through team membership, verify their team role grants virtual access (see [Virtual vs. Direct Access](#13-key-concept-virtual-vs-direct-access))

**See also:** [Virtual vs. Direct Access](#13-key-concept-virtual-vs-direct-access)

---

### 6.2 Can't Edit {{Notebook}} Structure

**Possible causes:**

- User has Contributor or Guest role (need Manager or Administrator)
- Virtual role from team membership is lower than required

**Solution:**

1. Check the user's {{notebook}} role in the Users tab
2. If they have a virtual role from team membership, check if it's Manager or above
3. To grant edit access:
   - Elevate their team role to Team Manager, OR
   - Invite them directly to the {{notebook}} as Manager or Administrator

---

### 6.3 Can't Add Users to Team

**Possible causes:**

- User doesn't have Team Manager or Team Administrator role
- User has Team Member role (cannot add others)

**Solution:**

1. Verify the user's team role
2. Only Team Manager and Team Administrator can add members
3. If they need to add users, elevate their team role or have someone with appropriate permissions add the user

---

### 6.4 Can't Assign Team Administrator Role

**Possible causes:**

- Only GENERAL_ADMIN can assign Team Administrator role
- Team Administrators cannot elevate others to their level

**Solution:**

1. Request a GENERAL_ADMIN to assign the Team Administrator role
2. This is a security feature to prevent unauthorised privilege escalation

---

### 6.5 User Has Access But Shouldn't

**Possible causes:**

- Virtual access from team membership
- Direct role that wasn't removed
- GENERAL_ADMIN has implicit access to everything

**Solution:**

1. Check if user has a direct {{notebook}} role — remove via Users tab
2. Check if user is a member of the owning team — remove from team if appropriate
3. Check if user is GENERAL_ADMIN — they have implicit access (this is expected behaviour)

> **Note:** You must remove both team membership AND direct roles to fully revoke access.

---

### 6.6 Can't Change a User's {{Notebook}} Role

**Possible causes:**

- {{Notebook}} roles cannot be edited directly (system limitation)

**Solution:**

1. Remove the user's current direct role (Users tab → trash icon, far right)
2. Create a new invite with the desired role (Invites tab → **+ Create Invite**)
3. Have the user accept the new invitation

> **Note:** This limitation exists because {{notebook}} roles are tied to the invitation mechanism. Team roles can be changed directly, but {{notebook}} roles require re-invitation.

---

*Guide Version: 1.1*
*Last Updated: 2026-01-19*
