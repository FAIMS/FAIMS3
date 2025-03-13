# About Fieldmark Notebooks

## Understanding the parts of a Notebook

A Fieldmark notebook is comprised of Forms which can be divided into Sections. Every Notebook must have at least one Field or Component, on one Section, on one Form.

## Notebook Status

Published notebooks (that are shared with other uses and ready for synchronisation) are green in colour. Draft notebooks that appear on your local device only are orange.

:::{attention}
Unpublished, draft notebooks are saved to your local device only. They will be deleted (along with all unsynchronised records) and you will *lose all your work* if you are required to 'Wipe and Reset the App' (see [Troubleshooting](advanced/troubleshooting)). 
:::


(intermediate/notebook-creation)=
# The Fieldmark Notebook Designer

Fieldmark offers a graphic user interface (GUI) for users to create and edit Notebooks. The Notebook Design allows for the creation of simple notebooks with some advanced features including the allocation of identifiers, simple validation and more. Custom features (eg the definition of hierarchical vocabularies) require hand-editing in .json. See [Advanced Notebook Creation](advanced/notebook-creation-advanced) for more information.

The following instructions provide steps for creating a simple notebook. While Notebooks can be created and edited on devices, the browser is recommended for Notebook design work.

## 1) Create New Draft Notebook

To create a new Notebook, tap or click on the sidebar on the left and choose New Notebook:

:::{image} /common-images/navigationbar.png
:alt: Navigation Bar
:width: 50%
:align: center
:::

:::{note}
if you can't see the New Notebook option, check your credentials with the Workspace Administrator.
:::

## 2) Enter Notebook Metadata

Enter Notebook metadata to describe the **Project** (which will become the name of the Notebook), the name or names of the **Project Leads** (who will be created with the Notebook creation) and the **Institution(s)** at which they are based.

![Enter Notebook metadata](notebook-creation-images/notebookdesign_metadata.jpg)

These basic project metadata fields are required.

### Project Metadata Components

You have the option of setting custom project-level metadata for your Notebook:

![Enter project component metadata](notebook-creation-images/notebookdesign_metacompontent.jpg)

These fields will be available for use in any Form created in the Notebook.

### User Roles

All projects have Admin, Moderator and Team roles by default.

You can define new roles here:

![Enter new user roles](notebook-creation-images/notebookdesign_userroles.jpg)

You will be able to assign Users to these roles later in the User tab.

### Attachments

Project level documents, maps or images can be attached here:

![Attach project-level documentation here](notebook-creation-images/notebookdesign_projectattach.jpg)

## 3) Create your first Form and Section

Click the blue + button to create your first Form:

![Fieldmark design interface](notebook-creation-images/notebookdesign_design.jpg)

To change the name of the Form, click the pencil icon, enter the desired name in the grey box and click the blue tick button or hit Enter.

Click 'SECTION DEFINITION' and then the blue + button to create your first Section:

![Fieldmark design interface - section](notebook-creation-images/notebookdesign_designsection.jpg)

To change the name of the Section, click the pencil icon, enter the desired name in the grey box and click the blue tick button or hit Enter.

Enter a description for this Section of the form in the Description box of the INFO tab. This description will appear at the top of the view in the App.

## 4) Add your first Field

See [Field and Record Types](intro/field-record-types) for an introduction to the available fields in Fieldmark.

To add an **Input** or **Select** field: click on the desired component listed below the ''+ ADD' button:

![Add a text input or select field](notebook-creation-images/notebookdesigner_textselect.jpg)

The field will then be ready for customisation:

![Add a text input or select field](notebook-creation-images/notebookdesign_addfield.jpg)

### Configure your first Field

Type over the **Label** with the desired name for your first field and enter some **Helper Text**:

![Rename a text input or select field](notebook-creation-images/notebookdesign_renamefield.jpg)

Tap on the checklist button to set the type of text field (default, string, number or email): ![Configure a text input or select field](notebook-creation-images/notebookdesign_configfield.jpg)

or determine choose to make the Field required, persistent or visible to related records:

![Configure a text input or select field](notebook-creation-images/notebookdesign_configfield2.jpg)

To determine who can see and edit the Field, tap the People icon and select the relevant user role:

![Configure a text input or select field](notebook-creation-images/notebookdesign_configfielduser.jpg)

To add attribute level metadata tap the Annotation icon and click to include Annotation and Certainty flags and edit the labels as needed:

![Configure a text input or select field](notebook-creation-images/notebookdesign_configfieldmeta.jpg)

To configure a select field, add your list in the Options box, separated by commas with no spaces:

![Configure a select field](notebook-creation-images/notebookdesign_configfieldselect.jpg)

## 5) Add your first Form Component

Components allow you to break up a Form with explanatory text to aide the recording process. Components aren't included on export. To add a component to your Form Section, click 'Title' and enter a **Label**, **Helper Text** and select the **Style**:

![Add a component](notebook-creation-images/notebookdesign_title.jpg)

If you wish to include custom html, cut and paste it in the html_tag box. If you wish to have custom html only, leave the label empty.

## 6) Organise your Fields and Components

To reorder Fields and Components on your Form Section, click on the grey arrows to move UP or DOWN.

## 7) Preview your Notebook

To see a preview of your current Notebook design, go to the PREVIEW tab:

![Preview your notebook](notebook-creation-images/notebookdesign_preview.jpg)

Here you can interact with the form but not enter data.

## 8) Configure Notebook Behaviour

You can set default Notebook-wide settings on the BEHAVIOUR tab to:

-   Automatically save changes a user makes as they occur
-   Allow offline use
-   Store content offline

![Configure your notebook behaviour](notebook-creation-images/notebookdesign_behaviour.jpg)

## 9) Save your Notebook

To save changes to your Notebook to your **local device**, go to the SUBMIT tab and click the SAVE NOTEBOOK button. Once successful you will see the white ‘CHECK NOTEBOOK’ button:

![Save and check your notebook](notebook-creation-images/notebookdesign_savenotebook.jpg)

Click 'CHECK NOTEBOOK' to enter your first test records.

**Note**: The **Notebook Designer** saves to your local device **only**. If working in a web browser, it saves to the browser's cache file and which can be easily wiped during browser updates. We recommend backing up your notebook frequently.

## Backing up your Saved Notebook

To backup your Save Notebook, go to the SETTINGS tab and scroll down to 'Metadata DB Contents' and click 'COPY TO CLIPBOARD':

![Save database metadata](notebook-creation-images/notebook_settings_db.jpg)

Open a new file in a text editor (eg Atom) and click Ctrl+V to paste the test. Save your file.

## Continue Editing your Notebook

Once saved, you can return to the Notebook Designer screen by clicking the 'EDIT NOTEBOOK DESIGN' button on the SETTINGS tab in your Notebook:

![Save and check your notebook](notebook-creation-images/notebook_settings.jpg)

Repeat Steps **2** to **9** until your Notebook is complete.

:::{note}
The **Notebook Designer** currently does not allow for Forms or Form Sections to be reordered. It is recommended that they be added with care.
:::

The order can be manually edited. See [Advanced Notebook Creation](advanced/notebook-creation-advanced) for more information.

## Publishing your Notebook

:::{note}
This feature is presently in development.
:::
