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
| Create or manage invites for system roles | [Managing Invites → Global invites](#28-managing-invites) |
| Figure out why someone can't see a {{notebook}} | [Troubleshooting: Can't See a {{Notebook}}](#61-cant-see-a-{{notebook}}) |
| Understand what roles exist | [Reference: Role Definitions](#51-role-definitions) |

### 1.2 Role Hierarchy Diagram

The diagram below shows roles at each of the three levels (System, Team, {{Notebook}}) and how team roles automatically grant corresponding {{notebook}} access through virtual role inheritance. Note that Team Member (Creator) does not automatically gain access to team {{notebooks}} — they must be explicitly invited.

```{image} ../images/permissions-hierarchy.png
:alt: {{FAIMS}} Permissions Hierarchy Diagram showing three tiers: System Level (Super User with full system control, Operations Administrator for user and team management, Content Creator for {{notebooks}} and templates, General User for basic access), Team Level (Team Administrator, Team Manager, Team Member Contributor, Team Member Creator with warning that Creator gets no automatic {{notebook}} access), and {{Notebook}} Level (Administrator, Manager, Contributor, Guest). Arrows indicate virtual role inheritance from team to {{notebook}} roles. A sidebar shows virtual role inheritance: Super User inherits all roles, Operations Admin inherits none, Team Administrator grants Administrator, Team Manager grants Manager, Team Member Contributor grants Contributor, Team Member Creator grants none.
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
| **Users** (system) | Create a global invite (Users → Invites tab) | Click "add" button in Roles column | Click × on role badge, then add new role | Click × on role badge (removes role only) |
| **Teams → Users** | Click "+ Add user" or go to **Invites** tab | Click "+" on existing member's row | Click × on role badge, then add new role | Click × on role badge (removes role only), or trash icon (removes user from team) |
| **{{Notebooks}} → Users** | Go to **Invites** tab | N/A (one role per user) | Remove user, then re-invite with desired role | Click trash icon (removes user from {{notebook}}) |

---

## 2. Common Tasks

### 2.1 Onboarding a New Staff Member

**When to use**: A new team member has joined and needs access to your team's {{notebooks}}.

**How new users are provisioned**: Users are created through an invite-based workflow — an Operations Administrator or Super User creates an invite, shares the code/link/QR code, and the user accepts it and signs in via SSO to create their account (see [How Users Are Created](#34-how-users-are-created)). Typically, enterprise users are onboarded with:

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
   - **Team Administrator** — for team leaders (requires OPERATIONS_ADMIN or GENERAL_ADMIN to assign)
7. Click **Add User** (in the dialog)

The new team member will immediately have virtual access to all team {{notebooks}} based on their role (see [Virtual vs. Direct Access](#13-key-concept-virtual-vs-direct-access)).

> **Note:** If you need to assign the Team Administrator role, you must have OPERATIONS_ADMIN or GENERAL_ADMIN permissions. Regular Team Administrators cannot elevate others to their level.

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
   - System roles (GENERAL_USER, GENERAL_CREATOR, OPERATIONS_ADMIN, GENERAL_ADMIN) cannot be removed by team administrators
   - Contact a system administrator (OPERATIONS_ADMIN or GENERAL_ADMIN) if system role removal is required

> ⚠️ **Warning**: Removing someone from a team removes their virtual access to all team {{notebooks}}. However, if they have direct roles on any {{notebooks}}, those must be removed separately.

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
| Project lead | Team Administrator (requires OPERATIONS_ADMIN or GENERAL_ADMIN) or Team Manager |
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

**Prerequisite**: Only users with **GENERAL_ADMIN** or **OPERATIONS_ADMIN** system role can create new teams.

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
:width: 100%
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

**Prerequisite**: Only users with **GENERAL_ADMIN** or **OPERATIONS_ADMIN** can assign the Team Administrator role. If you don't have this permission, request an OPERATIONS_ADMIN or GENERAL_ADMIN to perform the handover.

1. **Add colleague as Team Administrator:**
   - Click **Teams** → your team name → **Users** tab
   - Click **+ Add user** (to the right of the Filter field)
   - Enter their email address
   - Select **Team Administrator** role
   - Click **Add User**

2. **Verify they can access and manage:**
   - Ask them to log in
   - Confirm they can see the team and its {{notebooks}}
   - Have them verify they can access the Users tab and add/remove members

3. **Optionally remove yourself:**
   - Once confirmed, you can remove your own Team Administrator role if you no longer need it
   - Go to the team's **Users** tab → find your entry → click the small **×** on your Team Administrator role badge

> **Tip:** If you prefer not to share their email directly, you can create a single-use invite instead: go to the **Invites** tab → **+ Create Team Invite** → select **Team Administrator** role → set **Maximum uses** to 1 and a short **Invite Duration** (e.g., 24 hours).

> ⚠️ **Warning**: Never remove yourself before confirming the new Team Administrator has access and can manage the team. Ensure at least one Team Administrator remains.

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

> ⚠️ **Warning**: Never remove yourself before confirming the new Administrator has access. If you remove the last Administrator, no one can manage the {{notebook}}.

---

### 2.8 Managing Invites

**When to use**: Creating, tracking, or deleting pending invitations to teams, {{notebooks}}, or system-level roles.

**How invites work:**

- **Expiry**: Invites can have an expiration date after which they can no longer be used
- **Uses remaining**: You can limit how many times an invite code can be used
- **Sharing methods**: Once created, the system generates a Code, Link, and QR Code — share these with invitees via email, message, or in person

**Creating global invites (system-level roles):**

Global invites grant system-level roles (such as Operations Administrator) to anyone who accepts the invitation. Only users with the OPERATIONS_ADMIN or GENERAL_ADMIN role can manage global invites.

1. Click **Users** in the left sidebar → **Invites** tab
2. Click **+ Create Global Invite**
3. Configure:
   - **Invite title**: A descriptive name for the invitation
   - **Role**: The system role invitees will receive (General User, Content Creator, or Operations Administrator)
   - **Maximum uses**: How many people can use this invite (leave empty for unlimited)
   - **Invite Duration**: Choose a preset or custom expiry date (maximum 365 days)
4. Click **Create Invite**

```{screenshot} user-roles/02a-create-global-invite.png
:alt: Create Global Invite dialog with fields for invite title, role selection, maximum uses, and invite duration with Quick Select and Custom Date options
:align: right
:width: 100%
```

> 💡 **Note**: The Super User (GENERAL_ADMIN) role is deliberately excluded from the role dropdown. Super User access must be granted manually through the Users tab.

Once created, the invite appears in the Invites tab:

```{screenshot} user-roles/02-users-invites-tab.png
:alt: Users page Invites tab showing a table of global invitations with columns for Name, Role, Expiry, Uses remaining, Code, Link, QR Code, and Remove
:align: right
:width: 100%
```

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
:width: 100%
```

Once created, the invite appears in the Invites tab:

```{screenshot} user-roles/08a-teams-invites-tab.png
:alt: Team Invites tab showing list of pending invitations with columns for Name, Role, Expiry, Uses remaining, Code, Link, QR Code, and Remove
:align: right
:width: 100%
```

**Creating {{notebook}} invites:**

1. Click **{{Notebooks}}** → the {{notebook}} → **Invites** tab
2. Click **+ Create Invite** (to the right of the Filter field)
3. Configure options (same as team invites, but for {{notebook}} roles)
4. Click **Create Invite** (at the bottom of the dialog)

```{screenshot} user-roles/10-notebooks-invite.png
:alt: Create Invite dialog for a {{notebook}} showing Invite title field, Role dropdown with options (Administrator, Manager, Contributor, Guest), expiry date selection with Quick Select and Custom Date options, and Create Invite button
:align: right
:width: 100%
```

Once created, the invite appears in the Invites tab:

```{screenshot} user-roles/11-notebooks-invites-active.png
:alt: {{Notebook}} Invites tab showing list of active invitations with columns for Name, Role, Expiry, Uses remaining, Code, Link, QR Code, and Remove; includes + Create Invite button
:align: right
:width: 100%
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
| **System** | What a user can create globally | GENERAL_USER, GENERAL_CREATOR, OPERATIONS_ADMIN, GENERAL_ADMIN |
| **Team** | Access within a team | Team Administrator, Team Manager, Team Member |
| **{{Notebook}}** | Access to specific {{notebooks}} | Administrator, Manager, Contributor, Guest |

Each level is independent but interacts:

- System roles determine what users can create and modify (teams, {{notebooks}}, templates)
- Team roles provide virtual access to team resources ({{notebooks}}, templates)
- {{Notebook}} roles provide direct access to specific {{notebooks}}

### 3.2 What You Can Do As A Super User

As IT or change management staff, you may have been provisioned with:

- **GENERAL_ADMIN (Super User)** system role — full system control, with inherited Administrator access to all teams and {{notebooks}}

> ⚠️ **Recommendation**: For routine operations (user management, team creation), use the **OPERATIONS_ADMIN** role instead. GENERAL_ADMIN (Super User) is an emergency break-glass role that also grants full access to all research data.

This means you can:

**User management:**

- View all system users and their roles
- Add or remove system roles (GENERAL_USER, GENERAL_CREATOR, OPERATIONS_ADMIN, GENERAL_ADMIN)
- Reset user passwords (for non-SSO configurations)
- Remove user accounts

**Team management:**

- Create new teams
- Access and manage all teams
- Assign Team Administrator roles to others (only OPERATIONS_ADMIN or GENERAL_ADMIN can do this)

**{{Notebook}} management:**

- Access and manage all {{notebooks}}
- Edit or close any {{notebook}} regardless of ownership

> **Note:** If you cannot perform an action described in this guide, contact your system administrator to verify your role assignments.

### 3.2a What Operations Administrators Can Do

The **OPERATIONS_ADMIN** (Operations Administrator) role handles routine system management without access to research data:

**User and team management:**

- View all system users and their roles
- Add or remove system roles
- Create new teams
- Assign Team Administrator roles

**Cannot do (by design):**

- Access {{notebooks}}, templates, or research data
- The {{Notebooks}} and Templates sidebar items are hidden from this role

> **Note:** If you need both administrative control and {{notebook}} access, you need the GENERAL_ADMIN (Super User) role.

### 3.3 What Typical Enterprise Users Can Do By Default

During onboarding, enterprise users are typically provisioned (via invites) with:

- **GENERAL_CREATOR** system role — they can create {{notebooks}} and templates
- **Team Administrator** of their assigned team — they have full control over their team

This means they can immediately:

- Create {{notebooks}} (stand-alone or within their team)
- Invite users to their team and assign team roles
- Invite users to {{notebooks}} they administer and assign {{notebook}} roles
- Manage and update roles for their team members

> **Note:** Users do not have the necessary privileges to create their own teams. Teams are typically created during initial provisioning or by a GENERAL_ADMIN or OPERATIONS_ADMIN, and users are assigned as Team Administrator of their team via an invite.

### 3.4 How Users Are Created

In an enterprise deployment, users are created through an invite-based workflow:

1. An Operations Administrator (or Super User) creates an invite — either a global invite for system roles (Users → Invites tab), or a team invite for team roles (Team → Invites tab)
2. The invite is shared with the user via a code, link, or QR code
3. The user accepts the invite and completes sign-in via Single Sign-On (SSO) — this creates their account
4. The user's roles are determined by the invite(s) they accepted, not auto-provisioned

You cannot manually create user accounts through the {{Dashboard}} — users must accept an invite and sign in via SSO to create their account.

> **Note:** SSO auto-provisioning (where user accounts are automatically created on first SSO sign-in with default roles) is under development but not yet deployed. Currently, all user creation requires an invite.

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

```{screenshot} user-roles/01-dashboard-sidebar.png
:alt: {{FAIMS}} {{Dashboard}} showing left sidebar with Content section ({{Notebooks}}, Templates) and Management section (Users, Teams), plus the Users page with Users and Invites tabs, displaying Name, Email, Roles columns with role badges such as General User and Super User
:align: right
:width: 100%
```

#### Understanding System Roles

| Role | Display Name | Description | Typical User |
|------|--------------|-------------|--------------|
| GENERAL_USER | General User | View assigned resources, manage own tokens | Rarely used alone |
| GENERAL_CREATOR | Content Creator | Create {{notebooks}} and templates globally | Researchers, project managers |
| OPERATIONS_ADMIN | Operations Administrator | Manage users, teams, and system operations (no data access) | IT operations staff |
| GENERAL_ADMIN | Super User | Full system control, all data access (emergency use) | IT administrators |

#### Adding a Role to a User

1. Find the user in the Users list
2. In the **Roles** column, click **add** (next to the role badges)
3. Select the role to add from the dropdown
4. The new role badge appears next to any existing roles

```{screenshot} user-roles/03-add-user-role.png
:alt: Roles column in Users list showing the add button clicked, revealing a dropdown menu with four role options: General User, Super User, Content Creator, and Operations Administrator
:align: right
:width: 100%
```

#### Removing a Role from a User

1. Find the user in the Users list
2. In the **Roles** column, locate the role badge you want to remove
3. Click the **×** in the upper-right corner of the role badge
4. The role is removed immediately

> ⚠️ **Warning**: Be careful when removing roles. If you remove GENERAL_CREATOR from a user, they will no longer be able to create {{notebooks}} globally. However, they can still create {{notebooks}} within teams where they have the Team Member (Creator), Team Manager, or Team Administrator role.

#### Managing Global Invites

The **Users** page has two tabs: **Users** (for direct role management) and **Invites** (for invitation-based role assignment). Global invites grant system-level roles to anyone who accepts the invitation link.

**Who can manage global invites:** Only users with the OPERATIONS_ADMIN or GENERAL_ADMIN role.

**Creating a global invitation:**

1. Click **Users** in the left sidebar → **Invites** tab
2. Click **+ Create Global Invite**
3. Configure the invitation:
   - **Invite title** — A descriptive name
   - **Role** — General User, Content Creator, or Operations Administrator (Super User is excluded)
   - **Maximum uses** — Leave empty for unlimited
   - **Invite Duration** — Preset or custom expiry (maximum 365 days)
4. Click **Create Invite**
5. Share the generated code, link, or QR code with the invitee

**Viewing and managing global invites:**

The Invites tab shows all active global invitations. From here you can copy invite codes or links, display QR codes, and remove invites that are no longer needed.

For detailed screenshots of this interface, see [Managing Invites](#28-managing-invites) in Common Tasks.

### 4.2 Team Management

#### Viewing Your Team

1. Click **Teams** in the left sidebar
2. Click on your team name
3. You'll see tabs: **Details**, **Invites**, **{{Notebooks}}**, **Templates**, **Users**

```{screenshot} user-roles/05-teams-view.png
:alt: Team view for {{FAIMS}} Demo Team showing the tab bar with Details (selected), Invites, {{Notebooks}}, Templates, and Users tabs, plus the Edit button; main panel displays team name, description, Created By (admin), and timestamps
:align: right
:width: 100%
```

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

> ⚠️ **Note**: Team Member (Creator) is a special role for users who need to create {{notebooks}} but should not automatically see other {{notebooks}} in the team. They must be explicitly invited to each {{notebook}} they need to access.

#### Directly Adding a User to Your Team (no invite)

Use this method when you know the user's email address and want to add them immediately.

1. Navigate to **Teams** → your team name → **Users** tab
2. Click **+ Add user** (to the right of the Filter field)
3. Enter the user's email address
4. Select the appropriate role
5. Click **Add User** (in the dialog)

```{screenshot} user-roles/06-teams-users.png
:alt: Team Users tab showing member list with columns for Name, Email, Roles (displaying Team Administrator badges with × for removal and + to add roles), and Remove column with red trash icons
:align: right
:width: 100%
```

```{screenshot} user-roles/07-teams-add-user.png
:alt: Add user to team dialog with User Email text field and Role dropdown showing options: Team Member (Contributor), Team Member (Creator), Team Manager, and Team Administrator
:align: right
:width: 100%
```

The user appears in the team immediately. Only users who have already accepted an invite and signed in via SSO can be added this way.

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

> ⚠️ **Warning**: Ensure at least one Team Administrator remains before removing yourself. Only OPERATIONS_ADMIN or GENERAL_ADMIN can assign the Team Administrator role, so if you remove yourself, you'll need a system administrator to restore your access.

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

```{screenshot} user-roles/09a-notebooks-view.png
:alt: {{Notebooks}} list view showing sidebar with {{Notebooks}} expanded, and main content area with table columns for Name, Team, Template, {{Notebook}} Lead, and Description
:align: right
:width: 100%
```

2. Click on the {{notebook}} name
3. Click the **Users** tab
4. You'll see a list of users with their roles

```{screenshot} user-roles/09b-notebooks-users.png
:alt: {{Notebook}} Users tab showing user list with Name column, {{Notebook}} Roles column (displaying Administrator badges), and Remove column with trash icons
:align: right
:width: 100%
```

The Users tab shows two types of access:

- **Direct roles** — Users invited directly to this {{notebook}}
- **Virtual roles** — Users with access through team membership (shown with team indicator)

#### Understanding {{Notebook}} Roles

| Role | Display Name | Permissions |
|------|--------------|-------------|
| PROJECT_ADMIN | Administrator | Full control, manage administrators |
| PROJECT_MANAGER | Manager | Edit design, close {{notebook}}, export, manage invites/access |
| PROJECT_CONTRIBUTOR | Contributor | Edit others' records (plus all Guest permissions) |
| PROJECT_GUEST | Guest | Activate {{notebook}}, create records, view/edit/delete own records |

#### How {{Notebook}} Access Works

Users can access a {{notebook}} through:

1. **Direct role** — Explicitly invited to the {{notebook}}
2. **Virtual role** — Team membership grants automatic access
3. **GENERAL_ADMIN (Super User)** — has implicit access to all {{notebooks}}

> **Note:** OPERATIONS_ADMIN intentionally has no {{notebook}} access. This role manages system infrastructure without access to research data.

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

> ⚠️ **Warning**: Ensure at least one Administrator remains before removing yourself.

---

## 5. Reference

### 5.1 Role Definitions

#### System-Wide Roles

| Role | Display Name | Description | Typical User |
|------|--------------|-------------|--------------|
| GENERAL_USER | General User | View assigned resources, manage own tokens | Rarely used alone |
| GENERAL_CREATOR | Content Creator | Create {{notebooks}} and templates globally | Researchers, project managers |
| OPERATIONS_ADMIN | Operations Administrator | Manage users, teams, and system operations (no data access) | IT operations staff |
| GENERAL_ADMIN | Super User | Full system control, all data access (emergency use) | IT administrators |

#### Team Roles

| Role | Display Name | Permissions | Virtual {{Notebook}} Role |
|------|--------------|-------------|----------------------|
| TEAM_ADMIN | Team Administrator | Full team control | Administrator |
| TEAM_MANAGER | Team Manager | Manage members, create {{notebooks}} | Manager |
| TEAM_MEMBER | Team Member (Contributor) | Access team resources | Contributor |
| TEAM_MEMBER_CREATOR | Team Member (Creator) | Create {{notebooks}} only | **None** (no access to other team {{notebooks}}) |

> ⚠️ **Key restriction**: Only OPERATIONS_ADMIN or GENERAL_ADMIN can assign Team Administrator role. Team Member (Creator) cannot see other team {{notebooks}} — they must be explicitly invited.

#### {{Notebook}} Roles

| Role | Display Name | Permissions |
|------|--------------|-------------|
| PROJECT_ADMIN | Administrator | Full control, manage administrators |
| PROJECT_MANAGER | Manager | Edit design, close {{notebook}}, export, manage invites/access |
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

### 5.4 Permission Matrix — Teams

| Action | Member (Contributor) | Member (Creator) | Manager | Administrator |
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
| Add team administrators | ❌ | ❌ | ❌ | OPERATIONS_ADMIN or GENERAL_ADMIN only |
| Delete team | ❌ | ❌ | ❌ | ✅ |

> ⚠️ **Note**: Team Member (Creator) can create {{notebooks}} but does NOT automatically get access to existing team {{notebooks}}. This is by design for teaching environments where students create isolated {{notebooks}}.
>
> Virtual roles: Team Member (Contributor) automatically receives **Contributor** access to team {{notebooks}}. Team Manager automatically receives **Manager** access. Team Administrator inherits Manager's virtual role. Team Member (Creator) receives **no** virtual {{notebook}} access.

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

- Only OPERATIONS_ADMIN or GENERAL_ADMIN can assign Team Administrator role
- Team Administrators cannot elevate others to their level

**Solution:**

1. Request an OPERATIONS_ADMIN or GENERAL_ADMIN to assign the Team Administrator role
2. This is a security feature to prevent unauthorised privilege escalation

---

### 6.5 User Has Access But Shouldn't

**Possible causes:**

- Virtual access from team membership
- Direct role that wasn't removed
- GENERAL_ADMIN (Super User) has implicit access to everything

**Solution:**

1. Check if user has a direct {{notebook}} role — remove via Users tab
2. Check if user is a member of the owning team — remove from team if appropriate
3. Check if user is GENERAL_ADMIN (Super User) — they have implicit access (this is expected behaviour). Note: OPERATIONS_ADMIN does NOT have {{notebook}} access.

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

*Guide Version: 1.3*
*Last Updated: 2026-02-24*
