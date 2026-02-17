# Getting Started as a Data Collector


This quick start guide is for new users working in a small team with an existing **{{FAIMS}} {{Notebook}}**. You will need:

- a mobile device or computer (see [Hardware](hardware.md) for compatibility and recommendations)
- an internet connection, or be connected to the {{FAIMS}} Server (for the initial installation)
- an invitation to join a {{FAIMS}} {{Notebook}}

```{note}
If you are an Administrator setting up your **{{FAIMS}}** environment for the first time, see [Getting Started as an Admin](../admin/intro-admin.md).
If you are using an **Enterprise {{Notebook}}**, speak to your organisation’s Enterprise Administrator.
```

## 1) Install the {{FAIMS}} App

While you still have an internet connection, download the **{{FAIMS}} app** from the Google Play or the Apple App stores:

- Google Play: {{ANDROID_APP_LINK}}
- Apple App store: {{IOS_APP_LINK}}

Or open the **{{FAIMS}} app** on a web browser on your desktop, or on a mobile device, at one of the following addresses:

- {{FAIMS}} web app: {{APP_URL}}
- the server nominated by your organisation (see your Administrator for details)
- your organisation's server (for Enterprise users, see your Administrator for details)

## 2) Register and Login

When you open up the app for the first time you will see the **login** screen as shown here:  

```{screenshot} getting-started/app-login-mobile.png
:alt: Login Screen
:align: right
```

From here you can login if you already have an account, or refer to your {{Notebook}} invitation and:

- enter an **access code**, or
- scan a **QR code**

to **register** an account and get access to that {{Notebook}}.

````{note} 
If you already have an account on the {{FAIMS}} server, use the button to login instead of registering a new account.  Once you are logged in you will be given access to the {{Notebook}}. For more information, see [Login](./core/login.md).
````

### a) Invitation Codes

An **access code** contains a server prefix and six character code, eg  _FMRK-ABC123_, and gives you access to a specific {{notebook}}. Enter the six character code (eg _ABC123_) on the **Login** screen:

```{screenshot} getting-started/access-code-mobile.png
:alt: Access Code Screen
```

Once you enter the code, you will see the **Registration** screen.

If you have a **QR code**, click the QR Code button and scan the QR code with your device to get to the registration screen.

For more information see [Invitations](../core/invitations.md).

### b) Registering with {{FAIMS}}

If you don't already have an account on the {{FAIMS}} server, you will be able to **register** for an account at this point with either:

- your email and a password, or
- a supported authentication provider (eg your Google account)

At this point, registration just gives you access to this one {{notebook}} but you may be given access to others in the future.

````{note} 
You need an account on {{FAIMS}} to collect data so that the records that you create can be associated with you. The {{FAIMS}} server keeps minimal information about you: your name and email address. These are only used within the projects that you collect data for and will never be used for marketing or other purposes.
````

## 3) Activating your {{Notebook}}

After registering or logging in, you will see the main workspace screen in the app that shows the {{notebooks}} that you have access to:

```{screenshot} getting-started/notebooks-not-active-mobile.png
:alt: Main workspace of the app
:align: right
```

The {{notebook}} that you have just gained access to should appear in the _Not Active_ list.  

A {{notebook}} needs to be _activated_ on your device in order for you to be able to collect data.  

To activate a {{notebook}} on your device:

- click on the _Activate_ button next to the {{notebook}}, and
- wait for it to appear in the _Active_ list:


```{screenshot} getting-started/notebook-list-mobile.png
:alt: Main workspace of the app
:align: left
```

The sync process will now begin, linking your device to the server. You may able to see records from other users, depending on your role with respect to this {{notebook}}.

````{note}
For more information see [Activating {{Notebook}}s](./core/activating-notebooks.md).
````

## 4) Using your {{Notebook}}

Once your {{notebook}} is activated, you can begin to create records and these will be automatically saved to the server.  You may also be able to see records from other users, depending on your role with respect to this {{notebook}}.  

As each {{notebook}} is a customised data collection tool, it is difficult to provide universal guidelines at this point

Enter a {{notebook}} by touching or clicking on the name of the {{notebook}} in the
active list.  You will now see the {{notebook}} page where you can create new records
and see any existing records you have access to.   The page will look different
depending on the design of the {{notebook}} you are using.

### a) Navigating records

At the top of the page you will see buttons marked with a + sign that allow you to add
new records of a given type: in this case "Add New Main" since the form is called "Main".
A notebook can contain many forms and there can be one or
more of these "Add New" buttons configured.  Below these you will see the "Refresh Records"
button, this will force an update of the displayed list of records - the list will update
itself from time to time but sometimes it's useful to force a refresh

```{screenshot} getting-started/notebook-home-mobile.png
:alt: {{Notebook}} home page
:align: right
```

Below these buttons is the area where existing records are displayed along with
other information and controls for the {{notebook}}.  The "Details" tab has some details
about the {{notebook}} such as the owner and a description of the purpose of the {{notebook}}.
The "Settings" tab has a number of settings for the {{notebook}} on your device.  The
"Map" tab will show an overview map of the records that have been collected if those
records include GPS locations.

The main tab shows "My XXXX" where XXXX is the name of the form or "My Records" if there is more
than one form.  If you are collaborating with others and have access to their records, you
will also see an "Other Records" tab where you can browse the data they have entered.

The list of records shows a few pieces of information about each record; this can be different
in some {{notebooks}} depending on the configuration.  You should at least see an identifier
for the record, when it was created and by whom and the "Sync Status"; this last item will
show a green cloud with a tick if the record is known to be saved on the server and an amber
circle if upload is still pending.

### Creating a Record

```{screenshot} getting-started/record-form-mobile.png
:alt: Editing a {{Notebook}} record
:align: left
```

When  you create a new record or edit an existing one, you will see a form similar to
the screenshot shown here where you can enter your data. The details of the form will
depend on the configuration of the {{notebook}} you are using.

There are usually two tabs in a record form, 'Data' is where you will enter data,
'Info' provides some information about the record such as the name of the person who
created it and the creation time.   There is a third tab that can appear if there are
conflicts between versions of this record, we'll cover that later.

Filling out the form should be straightforward. You have a number of different
_field types_ that you can interact with. There will usually be a short help text
along with each field and in some cases, longer help is available via an icon next to
the field label.

The form you are filling may have more than one _section_, as shown in the screenshot here
where it is showing section 1 of 2 sections.  You can navigate between sections using
the 'Next' and 'Back' links.

```{screenshot} getting-started/record-form-finish-buttons-mobile.png
:alt: Finishing a {{Notebook}} record
:align: right
```

As you complete the form and scroll to the end of the section, you will see the 'Finish'
buttons as shown in this screenshot.   Above this, you may see a warning as shown
here if there are errors in the form - generally if you have missed entering some data.
The error message should include a link that will scroll to the field that is missing.
If the error is in a different section of the form, it will link you to that section.

If the form has errors, you are still able to finish your edits, all of the data that you
have entered will be saved and you can come back later to fix the errors.

The three buttons at the bottom of the form allow you to finalise the record you are
creating or the edits you've made.

The 'Finish and Close ...' button will finalise all of your changes and update the saved
record. It will then return you to either the main record list or the parent record
if this is a child record (see below).

The 'Finish and New ...' button will finalise the current record and start a new one
of the same type. This is useful if you are entering a series of observations.

The 'Cancel' button will cancel the current changes and return you to the record list
or the parent record.  It will first check that you are sure that you want to lose
the changes you have made.  

### Annotations and Uncertainty

In the screenshots above you might notice the small blue icon below some fields.  This
indicates that the {{notebook}} field has been configured to allow annotations.
If you click on this icon you will be able to enter either a textual annotation or note,
or check a box that might be labelled 'Uncertain' or something similar.  These
annotations are in addition to the data you enter in the field and can be used to
make a note about the data - for example that you were unable to take a measurement
properly or that you are uncertain about the exact value.    These annotations are
then available alongside the actual data when it is exported from {{FAIMS}}.

- [Child and Related Records](./related-records.md)

## 5) Get more help

Explore the {{FAIMS}} User Guide

See [Troubleshooting](advanced/troubleshooting) for more information or contact us at support@fieldmark.au.
