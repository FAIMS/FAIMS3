# Your First {{Notebook}} in 25-30 Minutes

*Welcome to {{FAIMS}}! In the next 25-30 minutes, you'll create your first data collection {{notebook}} and enter your first record. No experience needed - just follow along!*

## What You'll Achieve

By the end of this guide, you'll have:

- Created a working {{notebook}} from scratch
- Added three essential fields for data collection
- Configured critical settings to prevent common mistakes
- Activated your {{notebook}} and entered your first record
- Gained confidence to build more sophisticated data collection tools

## Before You Start

**You'll need**: A {{FAIMS}} account with at least Standard User permissions. If you don't have an account yet, ask your project administrator or team admin to invite you.

**Browser**: Works best with Chrome, Firefox, or Safari. Make sure you're using a recent version.

**URLs you'll use**:

- **Dashboard URL**: Usually `https://dashboard.fieldmark.app` (for designing and managing {{notebooks}})
- **Data Collection App URL**: Usually `https://app.fieldmark.app` (for entering records)
- Note: Your organisation may have custom URLs - check with your administrator

<!-- URLs comparison explained in text above - no screenshot needed -->

### Quick Terms to Know

Before we dive in, here are five terms you'll see:

- **{{Dashboard}}**: Your home screen after logging in - think of it as mission control
- **{{Notebook}}**: A customisable data collection form (like a digital fieldwork form)
- **Notebook Editor**: The visual tool where you build and modify {{notebooks}} and templates (sometimes just called "Editor")
- **Records**: The actual data entries people create using your {{notebook}}
- **Fields**: Individual input elements (like text boxes or photo buttons) in your form

---

## Step 1: Access Your {{Dashboard}} (3-5 minutes)

Let's begin by logging into {{FAIMS}} and finding our way around.

### Login to {{FAIMS}}

1. Open your browser and navigate to `https://dashboard.fieldmark.app`
2. Enter your email and password (or select the appropriate SSO provider, e.g., Google)
3. Click **Sign In**

```{screenshot} quickstart/quickstart-001-login.png
:alt: {{FAIMS}} login page with Email Address and Password fields, along with Sign in button and Continue with Google option
:align: right
```

### Welcome to Your {{Dashboard}}!

After logging in, you'll see the {{Dashboard}} interface:

- **Left sidebar**: Navigation options ({{Notebooks}}, Templates, Users, Teams)
- **Main content area**: Where you'll see lists of {{notebooks}}, templates, users, and teams.
- **User menu**: Your profile icon in the **bottom-left corner**

```{screenshot} quickstart/quickstart-002-dashboard-overview.png
:alt: {{FAIMS}} {{Dashboard}} showing left sidebar with {{Notebooks}}, Templates, Users, Teams navigation and main content area with {{notebook}} list and Create {{Notebook}} button; filter results search bar at top of the table and pagination controls at bottom (Page 1 of 19)
:align: right
```

> **Pro Tip**: Bookmark this page! You'll be coming back here often. In most browsers, press `Ctrl+D` (Windows/Linux) or `Cmd+D` (Mac) to bookmark.

### You'll Know It Worked When...

- [ ] You see your name or email in the bottom-left user menu
- [ ] The {{Dashboard}} (right pane) shows navigation options like {{Notebooks}}, Templates, Users, Teams
- [ ] You see a list of {{notebooks}} in the main window
- [ ] No error messages or login prompts appear

Great! You're in. Now let's create something amazing.

---

## Step 2: Create Your First {{Notebook}} (5-8 minutes)

**IMPORTANT**: We're creating a {{notebook}} directly, not from a template. Templates are an advanced feature - for now, we'll start simple.

### Create a New {{Notebook}}

From the {{Dashboard}}:

1. Click **{{Notebooks}}** in the left navigation
2. Click **+ Create {{Notebook}}**

### Name Your Creation

In the creation dialogue:

1. **{{Notebook}} Name**: Enter "My First Survey" (or choose your own name)
2. **Select team**: Choose your team from the dropdown
   - If you have only one team, it may be pre-selected
   - If you have multiple teams, select the appropriate one
3. Leave optional fields empty for now
4. Click **Create {{Notebook}}**

### Find Your New {{Notebook}}

**CRITICAL**: After creation, your {{notebook}} will appear at the **END of the {{notebook}} list**, not at the beginning.

1. If you have many {{notebooks}}, use these navigation tools:
   - **Search bar**: Type "My First Survey" in the search box at the top of the list
   - **Pagination controls**: Look at the bottom for "1-10 of X {{notebooks}}" with arrow buttons to navigate pages
2. Scroll through the list to find your {{notebook}} (it will be at the end)
3. Click on your {{notebook}} name to select it

### Open the Notebook Editor

1. Click the **Actions** tab
2. Click **Open in Editor**

```{screenshot} quickstart/quickstart-003-actions-tab-open-editor.png
:alt: {{Dashboard}} Actions tab selected, showing Edit {{Notebook}} section with Open in Editor button, along with other {{notebook}} management options like Assign {{notebook}} to a Team, Download JSON, and {{Notebook}} Status
:align: right
```

### Hello, Notebook Editor!

Fantastic! You're now in the Notebook Editor. This is where the magic happens.

You'll see the main interface elements:

- **Top bar**: CANCEL and SAVE buttons on the right
- **Action buttons**: UNDO and REDO buttons (below the top bar, above the tabs)
- **Tab bar**: DESIGN and INFO tabs on the left
- **"+" button**: Click to add a new form
- **Form editing area**: Shows "Form Name" field with "Form 1" pre-filled, and "ADD NEW FORM" button

> **Common Mistake**: Don't worry if it looks empty - that's normal! We're about to fill it with useful fields. Remember to click the green SAVE button in the top-right when you want to save your work.
>
> **Tip**: Notice the UNDO and REDO buttons below the top bar. Use these to recover from accidental deletions or changes. They're your safety net while building forms!

```{screenshot} quickstart/quickstart-004-editor-interface.png
:alt: {{Notebook}} Editor showing DESIGN and INFO tabs, UNDO/REDO buttons, Form Name field with "Form 1", ADD NEW FORM button, and blue info box explaining the form building process
:align: right
```

### You'll Know It Worked When...

- [ ] The Notebook Editor opens with "Form 1" in the Form Name field
- [ ] You see the blue info box with UI instruction text
- [ ] The "+" button is visible below the info box (for adding new forms)
- [ ] The Form Name field (showing "Form 1") is visible to the left of the green "ADD NEW FORM" button
- [ ] The DESIGN tab is selected and shows a green underline
- [ ] SAVE and CANCEL buttons are visible in the top-right
- [ ] No error messages appear

> **Mobile Users**: The Notebook Editor works best on tablets or computers. If you're on a phone, you might want to switch devices for this setup phase. Once created, your {{notebook}} will work perfectly on mobile for data collection!

### Understanding {{Notebooks}} Structure

Before we add fields, let's understand how {{FAIMS}} organises your data:

**{{Notebooks}}** contain **Forms** → **Forms** contain **Sections** → **Sections** contain **Form Fields** (where you enter data)

Think of it like this:

- **{{Notebook}}** = Your entire survey or data collection project ("My First Survey")
- **Form** = A specific data entry screen ("Site Details", "Environmental Observations", etc.)
- **Section** = A group of related fields within a form (optional, for organisation)
- **Form Field** = Individual data entry points (text boxes, dropdowns, etc.)

Right now, we have a {{notebook}} with one empty form called "Form 1". Let's make it more meaningful!

### Name Your Form

Let's give "Form 1" a descriptive name:

1. **Click in the Form Name field** (where it says "Form 1")
2. **Clear the text** and type **"Site Details"** (or another name that describes what data you'll collect)
3. **Press the green "ADD NEW FORM" button** to create the form

```{screenshot} quickstart/quickstart-005-form-name-editing.png
:alt: {{Notebook}} Editor showing Form Name field with 'Site Details' entered in the input box, with green ADD NEW FORM button ready to create the form
:align: right
```

> **Pro Tip**: Use descriptive form names like "Daily Observations", "Specimen Collection", or "Interview Notes" - they'll make it easier to navigate your data later.

### You'll Know It Worked When...

- [ ] The form name has changed from "Form 1" to your chosen name ("Site Details")
- [ ] You see the form badge showing "FORM: SITE DETAILS" in the editing area
- [ ] A green success message appears: "Form has been created. Add a section to get started."
- [ ] Form controls are visible: DELETE FORM and EDIT FORM NAME options
- [ ] Form Settings panel is visible below

Now you're ready to add a section to organise your fields!

### Create Your First Section

Sections help organise related fields within a form. Let's create one:

1. **Scroll down** to find the "Section Name" field (it should be visible below the success message)
2. **Click in the Section Name field** and type **"Basic Information"** (or another name that groups your first set of fields)
3. **Click the "+" button** next to the Section Name field to create the section

```{screenshot} quickstart/quickstart-007-section-name-editing.png
:alt: Form successfully created showing "FORM: SITE DETAILS" badge, green success message "Form has been created. Add a section to get started", DELETE FORM and EDIT FORM NAME options, Form Settings panel, and Section Name input field; section Name field with "Basic Information" entered and green "+" button next to it for creating the section
:align: right
```

> **Pro Tip**: Use section names like "Location Details", "Measurements", or "Photos" to group related fields - this makes forms easier to navigate, especially on mobile devices.

### You'll Know It Worked When...

- [ ] The interface changes to show your section: "Basic Information" with a green badge showing "1" (representing "first section")
- [ ] Section controls appear: DELETE SECTION, DUPLICATE SECTION, MOVE SECTION, EDIT SECTION NAME, ADD NEW SECTION
- [ ] You see the **"ADD A FIELD"** button (with green plus icon)
- [ ] "Visible Fields" and "Hidden Fields" areas are shown below
- [ ] The section is ready to receive form fields

```{screenshot} quickstart/quickstart-008-section-created.png
:alt: Section successfully created showing numbered badge "1", section title "Basic Information", section editing controls (DELETE SECTION, DUPLICATE SECTION, MOVE SECTION, EDIT SECTION NAME, ADD NEW SECTION), ADD CONDITION button, green ADD A FIELD button, and Visible Fields/Hidden Fields areas
:align: right
```

Perfect! Now your form has a section, and we're in the main editing interface where we'll add fields!

---

## Step 3: Add Your Fields (8-12 minutes)

Now for the fun part - let's add fields to collect data! We'll add three essential fields that demonstrate major field categories: text input, selection options, and media capture.

### Field 1: Site Name (Text Field)

1. **Click the "ADD A FIELD" button** (green button with plus icon)
2. **In the "Add a field" dialog that opens**:
   - **Field name**: Change "New Field" to **"Site Name"**
   - **Field type**: Click on **"FAIMS Text Field"** (single-line text input)
   - Click **"ADD FIELD"** button at bottom

```{screenshot} quickstart/quickstart-009-add-field-site-name.png
:alt: Add a field modal dialog with "Site Name" entered in the Field name box, TEXT tab active, and "FAIMS Text Field" option highlighted with green border
:align: right
```

1. **Click on the grey bar** to expand the field
2. **Configure the field**:
   - **Label**: Already shows "Site Name"
   - **Field ID**: Auto-generated as "Site-Name"
   - **Helper Text**: Type "Enter the official site designation or name"
   - **Required**: Toggle ON

```{screenshot} quickstart/quickstart-010-site-name-expanded.png
:alt: Expanded Site Name field showing Label "Site Name", Field ID "Site-Name", Helper Text "Enter the official site designation or name", Required checkbox checked with green checkmark, and additional options like Annotation, Uncertainty, Copy value to new records
:align: right
```

### You'll Know It Worked When...

- [ ] The "Site Name" field appears in the "Visible Fields" area
- [ ] Helper text displays: "Enter the official site designation or name"
- [ ] Required is checked
- [ ] The field is ready for data collection!

> **More Options**: Fields can also have Advanced Helper Text (formatted popup help), Conditions (show/hide based on other fields), Annotations, or "Copy value to new records" for smart defaults. We'll keep it simple for now!

#### Field 2: Site Type (Radio Buttons)

Now let's add a choice field where users select one option from a list.

1. **Collapse the Site Name field** - click on the grey bar to collapse it
2. **Click the "ADD A FIELD" button**
3. **In the "Add a field" dialog**:
   - **Field name**: Change "New Field" to **"Site Type"**
   - **Navigate to Choice fields**: Click the right chevron (>) next to the category tabs to see more options
   - **Field type**: Click on **"Select one option"** (creates radio buttons)
   - Click **"ADD FIELD"**

```{screenshot} quickstart/quickstart-011-add-field-choice.png
:alt: Add a field modal dialog showing CHOICE tab active with field types including Checkbox, Select Multiple, and "Select one option" (radio buttons) highlighted with green border
:align: right
```

1. **Click on the grey bar** to expand the field
2. **Add your options** - these are the choices users will see:
   - You'll see one default option "1" in the list
   - Click the **pencil icon** (edit) next to "1" to open the "Edit Option" dialog
   - Change "1" to **"Habitation"** and click **SAVE**
   - Now use **"Add Option"** field to add the remaining options:
     - Type **"Mortuary"** and click **"Add"**
     - Repeat for: **"Ceremonial"**, **"Workshop/Industrial"**, **"Defensive"**, **"Agricultural"**, **"Other"**
   - Use the drag handles (⋮⋮) or up/down arrows to reorder if needed

```{screenshot} quickstart/quickstart-012-edit-option-habitation.png
:alt: Edit Option modal dialog with Option Text field showing "1" being changed to "Habitation", and CANCEL/SAVE buttons at bottom
:align: right
```

1. **Configure the field**:
   - **Label**: Already shows "Site Type"
   - **Field ID**: Auto-generated as "Site-Type"
   - **Helper Text**: Type "Select the primary function of this site"
   - **Required**: Toggle ON
   - **Annotation**: Toggle ON (allows margin notes for qualifications)
   - **Uncertainty**: Toggle ON (allows flagging uncertain observations)

```{screenshot} quickstart/quickstart-013-site-type-expanded.png
:alt: Expanded Site Type field showing complete options list (Habitation, Mortuary, Ceremonial, Workshop/Industrial, Defensive, Agricultural, Other) with drag handles, Required checkbox checked, Annotation checkbox checked with label "annotation", and Uncertainty checkbox checked with label "uncertainty"
:align: right
```

### You'll Know It Worked When...

- [ ] The "Site Type" field shows a green "Required" badge in the header
- [ ] All 7 options are visible in the list: Habitation, Mortuary, Ceremonial, Workshop/Industrial, Defensive, Agricultural, Other
- [ ] Helper text displays: "Select the primary function of this site"
- [ ] Required , Annotation , and Uncertainty are all checked with green checkmarks
- [ ] The field is ready for data collection!

> **{{FAIMS}} Feature**: The **Annotation** and **Uncertainty** toggles are unique to {{FAIMS}}! They help capture data quality nuances:
>
> - **Annotation**: Add contextual notes (e.g., when selecting "Other", use annotation to describe what type of site it actually is)
> - **Uncertainty**: Flag observations you're unsure about for later review
>
> **Pro Tip**: You can use markdown in option text - try `**Important Option**` to make text bold!

**Quick Save**: Click the **SAVE** button in the top-right to save your progress.

#### Field 3: Site Photo (Camera)

Let's add the ability to capture photos - essential for field documentation!

1. **Collapse the Site Type field** - click on the grey bar to collapse it
2. **Click the "ADD A FIELD" button**
3. **In the "Add a field" dialog**:
   - **Field name**: Change "New Field" to **"Site Photo"**
   - **Field type**: Click on the **MEDIA** tab
   - Select **"Take Photo"** (enables camera capture)
   - Click **"ADD FIELD"**

```{screenshot} quickstart/quickstart-018-add-field-media.png
:alt: Add a field modal dialog with "Site Photo" entered as field name, MEDIA tab active, showing "Upload a File" and "Take Photo" options with Take Photo highlighted with green border
:align: right
```

1. **Click on the grey bar** to expand the field
2. **Configure the field**:
   - **Label**: Already shows "Site Photo"
   - **Field ID**: Auto-generated as "Site-Photo"
   - **Helper Text**: Type "Photograph the site for documentation"
   - Leave **Required** unchecked (photos can be optional)
   - **Annotation**: Toggle ON
   - **Annotation Label**: Change from "annotation" to **"Photo notes"**

```{screenshot} quickstart/quickstart-019-site-photo-expanded.png
:alt: Expanded Site Photo field in collapsed list view and detailed configuration view showing Label "Site Photo", Field ID "Site-Photo", Helper Text "Photograph the site for documentation", Annotation checkbox checked with custom label "Photo notes", and other configuration options
:align: right
```

### You'll Know It Worked When...

- [ ] The "Site Photo" field appears in the Visible Fields list with "TakePhoto" badge
- [ ] Helper text displays: "Photograph the site for documentation"
- [ ] Annotation is checked with custom label "Photo notes"
- [ ] All 3 fields are now visible: Site Name, Site Type, Site Photo
- [ ] Your form is ready for data collection!

```{screenshot} quickstart/quickstart-020-all-fields-visible.png
:alt: Visible Fields section showing all three collapsed fields in order: Site Name (FAIMSTextField, Required badge), Site Type (RadioGroup, Required badge), Site Photo (TakePhoto)
:align: right
```

> **Progress Check**: You should now see three fields in your Visible Fields list:
> Site Name, Site Type, and Site Photo. Each shows its field type badge. You're doing great!

### Configure Form Settings CRITICAL

This configuration is **essential**. The Human-Readable ID Field setting prevents your records from displaying as confusing codes like "rec_a7f3b2c1" instead of meaningful names.

Now let's configure how the form behaves when collecting data.

```{screenshot} quickstart/quickstart-021-form-settings-panel.png
:alt: Form Settings panel showing configuration options including Finish Button Behavior, Layout Style, Summary Fields, and Human-Readable ID Field dropdowns
:align: right
```

1. **Find the Form Settings panel** at the top of the form editor (below "FORM: SITE DETAILS")
2. **Click anywhere in the grey "Form Settings" bar** to expand the settings if collapsed
3. **Configure the settings**:
   - **Finish Button Behavior**: Leave as **"Always Show"** (users can save records anytime)
   - **Layout Style**: Leave as **"Tabs"** (sections display as tabs for organised navigation)
   - **Summary Fields**: Click the dropdown and select both **"Site Name"** and **"Site Type"** (these will show in the record list table)
   - **Human-Readable ID Field**: Select **"Site Name"** (provides meaningful record labels instead of opaque, computer-generated identifiers (UUIDs))

> **CRITICAL: Human-Readable ID Field**
>
> **DO NOT skip this setting!** This is a very common mistake new users make.
>
> Without setting the Human-Readable ID Field, your records will display as:
>
> - `rec_a7f3b2c1` (meaningless code - which site is this??)
> - `rec_9d2e4b8f` (impossible to identify!)
> - `rec_f1c5a39e` (you'll never find what you're looking for)
>
> With Human-Readable ID Field set to "Site Name", your records display as:
>
> - `Ancient Temple Site` (instantly recognisable!)
> - `Northern Settlement` (clear and meaningful)
> - `Burial Ground Alpha` (easy to find and manage)
>
> **Set it now before saving!** Changing it later won't fix existing records.

```{screenshot} quickstart/quickstart-022-form-settings-configured.png
:alt: Form Settings panel fully configured showing Finish Button Behavior set to "Always Show", Layout Style set to "Tabs", Summary Fields showing "Site Name ×" and "Site Type ×" tags, and Human-Readable ID Field set to "Site Name"
:align: right
```

> **Advanced Option**: The "Finish Button Behavior" can be changed to "Show Only When No Errors Exist" to ensure all required fields are completed before allowing save, or "Show Once All Sections Visited" to guide users through multi-section forms.

### You'll Know It Worked When...

- [ ] Form Settings panel shows all four settings configured
- [ ] Summary Fields displays "Site Name ×" and "Site Type ×" (× removes item)
- [ ] Human-Readable ID Field shows "Site Name"
- [ ] All 3 fields are visible in your "Basic Information" section below

### Save Your Work

**Important:** The Notebook Editor does not auto-save. Let's save your progress now.

1. **Click the green SAVE button** in the top-right corner
2. **You'll be returned to the {{Dashboard}}** - this is expected behaviour
3. **To continue editing later**, simply click **"Open in Editor"** again from the {{Dashboard}}

> **Remember to Save**: Get in the habit of clicking SAVE periodically as you work. The Editor will close and return you to the {{Dashboard}} each time you save, but you can immediately click "Open in Editor" to resume editing.
>
> **Tip**: You can always resume editing your {{notebook}} at any time by returning to the {{Dashboard}}, selecting your {{notebook}} from the list, clicking the **Actions** tab, and choosing **Open in Editor**. Your work is saved and ready to continue.
>
> **Pro Tip**: Start simple like we just did. You can always come back to add more fields, validation rules, or conditional logic. Most successful {{notebooks}} begin with 3-7 core fields and evolve based on actual use. Once you're comfortable with the basics, explore the **INFO tab** to add project metadata like project lead, organisation, and custom key-value pairs. You can also try adding more field types - date/time fields, multi-line text for observations, location capture, and more!

---

## Step 4: Activate and Test Your {{Notebook}} (5-8 minutes)

Time to see your creation in action! Let's activate your {{notebook}} in the {{FAIMS}} mobile app and enter test data.

### Open the {{FAIMS}} App

Your {{notebook}} has been saved in the Editor. Now let's activate it for data collection:

1. **Open a new browser tab** and navigate to your {{FAIMS}} data collection app URL (usually `https://app.fieldmark.app`)
2. **Log in** with the same credentials you used to access the Editor

```{screenshot} quickstart/quickstart-023-active-zero.png
:alt: {{FAIMS}} mobile app My {{Notebooks}} screen showing ACTIVE (0) tab selected with empty state message explaining {{notebooks}} need to be activated, and NOT ACTIVE tab visible (number in parentheses shows count of {{notebooks}} available to activate), plus REFRESH NOTEBOOKS button
:align: right
```

### Activate Your {{Notebook}}

When the app opens, you'll see the "My {{Notebooks}}" screen:

```{screenshot} quickstart/quickstart-024-not-active-tab.png
:alt: NOT ACTIVE tab showing list of available {{notebooks}} with green ACTIVATE buttons next to each, including {{notebooks}} like "Map Tester May", "Groundwater", "NIMY Nathan", and others, with horizontal scroll for pagination
:align: right
```

1. **Click on the "NOT ACTIVE" tab** - you'll see a list of {{notebooks}} that need activation
2. **Find your {{notebook}}** in the list (look for "My First Survey" or whatever name you chose)
   - If you have many {{notebooks}}, scroll through the list to locate yours
3. **Click the green "ACTIVATE" button** next to your {{notebook}}
4. **A modal dialog appears** explaining activation

```{screenshot} quickstart/quickstart-025-activating-modal.png
:alt: Activating {{Notebooks}} modal dialog with blue information icon, explanation text about offline functionality and data downloading, warning about stable internet connection, note about de-activation not being available yet, and green ACTIVATE and CANCEL buttons at bottom
:align: right
```

1. **Read the information** in the modal:
   - Explains that activating downloads existing records to your device
   - Warns that you need a stable internet connection
   - Notes that you currently cannot de-activate {{notebooks}} (feature coming soon)
2. **Click the green "ACTIVATE" button** in the modal to confirm
3. **You'll be automatically taken to the "ACTIVE" tab** - your {{notebook}} now appears in the Active list

```{screenshot} quickstart/quickstart-026-active-one.png
:alt: ACTIVE (1) tab showing Quickstart-test {{notebook}} in the list with Name column header and pagination showing 1-1 of 1
:align: right
```

> **What does Active mean?** When a {{notebook}} is "Active", all data you collect will be saved to your device for offline work. Activating downloads existing {{notebook}} records to your device. We recommend completing this while you have a stable internet connection.
>
> **Don't see your {{notebook}}?** If your {{notebook}} doesn't appear in the NOT ACTIVE list, make sure you're logged in with the same credentials you used in the Editor. If you still don't see it, contact your {{FAIMS}} administrator about permissions.

### You'll Know It Worked When...

- [ ] The view automatically switches to the "ACTIVE" tab showing "ACTIVE (1)"
- [ ] Your {{notebook}} appears in the list under the ACTIVE tab
- [ ] You can now click on the {{notebook}} name to open it

### Understanding Offline-First Design

Before we continue, here's an important feature: {{FAIMS}} is designed to work offline.

> **Offline-First**: No network connection is needed for data collection in the field. Your data is saved locally to your device, and it automatically syncs to the server when you have connectivity (unless you've disabled sync in Settings). This means you can collect data anywhere, anytime.

This is why we "activate" {{notebooks}} - the activation process downloads the {{notebook}} structure to your device so you can work without internet.

### Open Your {{Notebook}}

Now let's open your {{notebook}} to start collecting data:

1. **Click on your {{notebook}}'s name** in the ACTIVE tab (e.g., "Quickstart-test" or "My First Survey")

You'll see the record list interface:

- **ADD NEW SITE DETAILS** button (orange) - for creating new records
- **REFRESH RECORDS** button (green) - refreshes the displayed list from local database (useful to see records synced in the background)
- **MY SITE DETAILSS (0)** tab - shows your record list (currently empty)
- Additional tabs: DETAILS, SETTINGS, MAP
- **Empty table** showing column headers for your data (Site Name, Site Type, Created, Last Updated, etc.)
- "No rows" message - because this is a brand new {{notebook}}

```{screenshot} quickstart/quickstart-027-empty-notebook.png
:alt: Empty Quickstart-test {{notebook}} showing ADD NEW SITE DETAILS button (orange), REFRESH RECORDS button (green), MY SITE DETAILSS (0) tab, DETAILS, SETTINGS, and MAP tabs, empty table with column headers (Sync, Site Name, Site Type, Created, Created By, Last Updated, Last Updated By), "No rows" message, search bar, Filters button, and pagination showing 0-0 of 0
:align: right
```

### Create Your First Record

Let's add your first record:

1. **Click the orange "ADD NEW SITE DETAILS" button**

```{screenshot} quickstart/quickstart-028-form-33-percent.png
:alt: Blank data entry form for Site Details showing 0% Completed progress bar, empty Site Name field (required, red asterisk) with helper text "Enter the official site designation or name", Site Type radio button field (required, none selected) showing all seven options (Habitation, Mortuary, Ceremonial, Workshop/Industrial, Defensive, Agricultural, Other) with blue annotation icon, and Site Photo field with camera icon and helper text "Photograph the site for documentation"
:align: right
```

You'll see the data entry form with a progress bar at the top. Notice that required fields are marked with a red asterisk (*).

1. **Fill in Site Name**:
   - Type **"Test Location Alpha"** in the Site Name field
   - Helper text shows: "Enter the official site designation or name"

2. **Fill in Site Type**:
   - Select **"Habitation"** from the radio button options
   - Notice the **blue dog ear icon** on the right - this opens annotation and uncertainty fields

3. **Optional: Try the Annotation feature** (if you want to explore it):
   - Click the **blue dog ear icon** next to Site Type
   - An annotation text area and uncertainty checkbox appear below
   - Type a note like: "This site is likely a dwelling but may be a workshop."
   - Check the **uncertainty** checkbox to flag this observation as uncertain
   - This is a powerful feature for capturing data quality context!

   ```{screenshot} quickstart/quickstart-029-annotation-interface.png
:alt: Site Type field with "Habitation" selected (green radio button), showing all seven options (Habitation, Mortuary, Ceremonial, Workshop/Industrial, Defensive, Agricultural, Other), with annotation interface expanded below displaying text area containing "This site is likely a dwelling but may be a workshop." and uncertainty checkbox checked with green checkmark
:align: right
```

4. **Add a Site Photo**:
   - Scroll to the Site Photo section
   - You'll see "No Photos Yet" with a **"TAKE FIRST PHOTO"** button
   - Click the green photo button
   - Allow camera permissions if asked
   - Take any photo (even of your desk - this is just practice!)
   - Note: Site Photo also has a blue dog ear icon for "Photo notes" annotation

![Complete data entry form showing 100% Completed progress bar at top, header displaying "[Site Details] Test Location Alpha" with timestamp, DATA and INFO tabs, Site Name field filled with "Test Location Alpha", Site Type field with "Habitation" selected (green radio button), and Site Photo section displaying an uploaded photograph of a coastal landscape with rocky shoreline, plus green add photo button and trash icon for deletion](../screenshots/quickstart/final/quickstart-030-form-100-percent.png)

### Save Your Record

At the bottom of the form, you'll see three buttons:

- **FINISH AND CLOSE SITE-DETAILS** (green) - saves the record and returns to the record list
- **FINISH AND NEW SITE-DETAILS** (orange text) - saves the record and immediately opens a new blank form (useful for entering multiple records in a row)
- **CANCEL** (orange) - discards the record without saving

**Click "FINISH AND CLOSE SITE-DETAILS"** to save your first record!

```{screenshot} quickstart/quickstart-031-datetime-picker.png
:alt: Bottom of form showing form action buttons: FINISH AND CLOSE SITE-DETAILS (green), FINISH AND NEW SITE-DETAILS (orange text), and CANCEL (orange)
:align: right
```

Congratulations! You've just created your first {{FAIMS}} record!

### You'll Know It Saved When...

You're automatically returned to the record list view. Here's what you'll see:

```{screenshot} quickstart/quickstart-032-record-not-synced.png
:alt: Record list showing MY SITE DETAILSS (1) tab with table containing one record: orange three-dot sync icon in Sync column, "Test Location Alpha" in Site Name, "Habitation" in Site Type, "2025-10-02 18:32:49" in Created, "shawn@fieldnote.com.au" in Created By and Last Updated By columns, pagination showing 1-1 of 1
:align: right
```

- **MY SITE DETAILSS (1)** tab now shows 1 record (changed from "(0)")
- Your record appears in the table with the following columns:

  - **Sync**: Orange icon with three dots (indicates not yet synced to server)
  - **Site Name**: "Test Location Alpha" (Summary Field #1)
  - **Site Type**: "Habitation" (Summary Field #2)
  - **Created**: Timestamp like "2025-10-02 18:32:49"
  - **Created By**: Your username (e.g., "shawn@fieldnote.com.au")
  - **Last Updated**: Same as Created for a new record
  - **Last Updated By**: Your username
- **Pagination** at bottom shows "1-1 of 1"

> **About Sync**: {{FAIMS}} automatically syncs records when you're online. The orange icon with three dots means the record hasn't synced to the server yet. Once synced, it will turn into a green cloud icon with a checkmark. If other team members have added records, click the **REFRESH RECORDS** button to update your view with records that synced in the background.
>
> If multiple team members edit the same record while offline, {{FAIMS}} has a conflict resolution interface in the data collection app to help you merge changes.

```{screenshot} quickstart/quickstart-033-record-synced.png
:alt: Record list showing same record with green cloud and checkmark icon in Sync column indicating successful synchronization to server
:align: right
```

### {{Notebook}} Settings

Before we finish, let's explore the SETTINGS tab to understand sync and data management options.

1. **Click on the SETTINGS tab** (next to MY SITE DETAILSS, DETAILS, and MAP tabs)

```{screenshot} quickstart/quickstart-034-settings-tab.png
:alt: SETTINGS tab showing Sync {{Notebook}} section with toggle switch ON and explanation text, Get attachments from other devices section with toggle Off and detailed explanation about trade-offs, and Deactivate {{Notebook}} section with warning text and red DEACTIVATE NOTEBOOK button
:align: right
```

You'll see several important controls:

**Sync {{Notebook}}**

- Toggle switch (currently ON)
- Controls whether this {{notebook}} syncs to the server
- Turn this OFF to save mobile data when working in the field
- Your data is still saved locally; it will sync when you turn it back ON

**Get attachments from other devices**

- Toggle switch (currently Off)
- When enabled, {{FAIMS}} automatically downloads photos and attachments created by other team members
- **Trade-off**: Lets you see what your team is documenting, but uses more storage and mobile data
- **Important**: Your uploads always go to the server regardless of this setting
- Recommended: Keep OFF to minimize data usage, turn ON when on WiFi if you want to review team photos

**Deactivate {{Notebook}}**

- Removes the {{notebook}} from your active list
- **Warning**: Make sure all your data has synced before deactivating (check for green cloud icons!)
- Click **DEACTIVATE NOTEBOOK** button (red text) only if you're done using this {{notebook}} on this device

> **Data Management Tip**: If you're working in areas with limited connectivity or want to conserve mobile data, turn OFF "Sync {{Notebook}}" while collecting data. Turn it back ON when you have WiFi to upload your records to the server.

---

## You Did It!

Congratulations! You've successfully created your first {{FAIMS}} {{notebook}} and collected your first record. You've:

- Created a {{notebook}} in the Notebook Editor
- Added forms, sections, and fields with proper configuration
- Configured Form Settings (Summary Fields, HRID)
- Activated the {{notebook}} in the {{FAIMS}} app
- Created and saved your first record
- Learned about sync settings and data management

**This is a major milestone!** You now understand the core {{FAIMS}} workflow from design to data collection.

---

## Success Checklist

Congratulations! Let's review everything you've accomplished:

- [ ] Logged in to {{FAIMS}} and accessed your {{Dashboard}}
- [ ] Created a new {{notebook}} using the Notebook Editor
- [ ] Added three fields: text, choice, and photo
- [ ] Configured the Human-Readable ID Field (critical step!)
- [ ] Saved your {{notebook}} (and understood that SAVE returns you to {{Dashboard}})
- [ ] Activated your {{notebook}} in the mobile app
- [ ] Created and saved your first record
- [ ] Saw your record display properly in the records list
- [ ] Understand how to edit and improve your {{notebook}}

**If you've ticked all these boxes, you're officially a {{FAIMS}} {{notebook}} creator!**

---

## Next Steps

Ready to take your {{notebook}} further? All of these features are managed through the **Control Centre** after selecting your {{notebook}} from the list:

- **Invite team members** - Share your {{notebook}} and assign roles (Data Collector, Reviewer, Viewer, Admin)
- **Add more forms, sections, and fields** - Build out your data collection structure
- **Export your data** - Download records as CSV, JSON, or other formats for analysis
- **Turn your {{notebook}} into a template** - Reuse and modify your design for similar projects
- **Explore conditional logic** - Make forms that adapt based on user input
- **Try advanced field types** - Geolocation, related records, auto-incrementers, and more

> **Templates Are Advanced**: We started with direct {{notebook}} creation because it's best to field-test your design before creating reusable templates. Once you've used your {{notebook}} in real scenarios and refined it based on actual needs, you can convert it into a template for future projects. This approach prevents over-engineering and ensures your templates reflect practical requirements.
>
> **Control Centre Access**: Log into the Control Centre, select your {{notebook}} from the list, and explore the management options available to you based on your permissions.

---

## Troubleshooting {optional-reference}

> **Note**: This section is optional reference material. Most users won't encounter these
> issues. Refer to this section if you get stuck.

### Can't Find the Notebook Editor

**Solution**: Look for "{{Notebooks}}" in your navigation, click "Create {{Notebook}}" and supply required information. Note the name you give your {{notebook}}. Then find your {{notebook}} at the end of the list. Click the {{notebook}} name → Actions tab → Open in Editor. If youu don't see this option, check with your administrator about permissions.

### {{Notebook}} Not in List After Creation

**Solution**: New {{notebooks}} appear at the END of the list, not the beginning. Use pagination
controls at the bottom ("1-10 of X {{notebooks}}") to navigate to the last page, or use the
search bar to find your {{notebook}} by name.

### Fields Not Showing in the Form

**Solution**: Make sure you clicked "ADD FIELD" at the bottom of the dialogue. Also check that
fields are in "Visible Fields" not "Hidden Fields" in the editor.

### Editor Closed After Clicking Save

**This is expected behaviour**: The Editor does not auto-save. Clicking SAVE closes the Editor
and returns you to the {{Dashboard}}. Your work is saved. To resume editing: find your {{notebook}}
in the list → Actions → Open in Editor.

### Records Show "rec_xxxxx" Instead of Readable Names

**Solution**: This is a common issue! Go back to editing your {{notebook}}. Open Form
Settings and set the "Human-Readable ID Field" to "Site Name". Save the changes. New records
will display properly (existing records will keep the old format).

### {{Notebook}} Not Appearing in Mobile App

**Solution**: Make sure you're logged into the mobile app (app.fieldmark.app) with the same
credentials you used in the {{Dashboard}}. If you still don't see it, check with your administrator
about team permissions.

### Photos Won't Upload

**Solution**: On mobile, check camera permissions in your device settings. On desktop, the Take
Photo field works best on mobile devices.

---

## Get Help

- **Documentation**: Comprehensive guides for all {{FAIMS}} features
- **Team Support**: Ask your team administrator for organisation-specific guidance
- **In-app Help**: Look for the help icon (?) throughout the interface

---

## Keep Learning

You've mastered the basics - now it's time to experiment! Try creating a {{notebook}} for a real use case, test it on mobile devices, and explore the features that matter most to your work.

**Welcome to the {{FAIMS}} community!**

---

Remember: Every expert was once a beginner. You've taken your first steps, and that's the hardest part. Keep experimenting, keep learning, and most importantly - keep collecting great data!
