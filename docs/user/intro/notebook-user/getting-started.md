# Getting Started as a Data Collector

{{FAIMS}} is a mobile app for collecting data in the field and can be used in
a wide range of projects.  Each **{{notebook}}** is a collection of forms to
allow you to enter data for your project.  As a data collector, you will be
using the mobile app to enter data for your project into one or more
{{notebook}}s.

## Install the {{FAIMS}} App

The {{FAIMS}} app is available for Android and iOS devices.  You can install the
app from the Google Play Store or the Apple App Store.

## Registration and Login

```{screenshot} getting-started/app-login-mobile.png
:alt: Login Screen
:align: right
```

When you open up the app for the first time
you will see the registration/login screen as shown here.  Here you can login to
the app if you already have an account or use an access code or QR code to register
an account and get access to a {{notebook}}.

You need an account on {{FAIMS}} to collect data so that the records that you
create can be associated with you.  The {{FAIMS}} server keeps minimal information
about you - your name and email address - this is only used within the projects
that you collect data for and will never be used for marketing or other purposes.

## Your Invitation

Once the mobile app has been installed, you can get access to a {{notebook}} by getting
an invitation in the form of an access code or a QR code.

```{screenshot} getting-started/access-code-mobile.png
:alt: Access Code Screen
```

An access code looks something like _FMRK-ABC123_ and gives you access to a {{notebook}}.
The first part (_FMRK_) is a prefix that identifies the server and should match
the prefix shown in your app.  The six character code following that is the code
that you will enter in the app.  Once you enter the code, you will
see the registration screen in the app.

The QR code option makes it easy to get access to a {{notebook}}.  Click the
QR Code button and scan the QR code with your device to get to the registration
screen.

If you don't already have an account on the {{FAIMS}} server, you will be able to
register for an account at this point.  You can either register with your email
and password, or you can use a Google account.
At this point, registration just gives you access to this one
{{notebook}} but you may be given access to others in the future.

If you already have an account on the {{FAIMS}} server, use the button to login
instead of registering a new account.  Once you are logged in you will be given
access to the {{notebook}}.

After registering or logging in, you will be shown the main {{notebook}} list in
the app and you can activate the {{notebook}} you will be working on.

## Activating {{Notebooks}}

```{screenshot} getting-started/notebooks-not-active-mobile.png
:alt: Main workspace of the app
:align: right
```

Once you have registered an account you will see the main workspace screen in
the app that shows the {{notebooks}} that you have access to and those that you
are working on. A {{notebook}} needs to be _activated_ on your device in order for
you to be able to collect data.   You will see an initial screen showing active
and not active {{notebooks}} with the {{notebook}} you have just gained access to in
the not active list.  Your first step is to activate this {{notebook}} on your device
so  you can work with it; to do this, click on the _Activate_ button next to the
{{notebook}}.

Activating the {{notebook}} will create the required databases on your device and begin
the sync process that links your device to the server to save your data.  Once activated,
you can begin to create records in your {{notebook}} and these will be automatically
saved to the server.  You may also be able to see records from other users, depending
on your role with respect to this {{notebook}}.  Once activated, your notebook will
appear in the _Active_ list in your workspace.

```{screenshot} getting-started/notebook-list-mobile.png
:alt: Main workspace of the app
:align: left
```

## Using a {{Notebook}}

Enter a {{notebook}} by touching or clicking on the name of the {{notebook}} in the
active list.  You will now see the {{notebook}} page where you can create new records
and see any existing records you have access to.   The page will look different
depending on the design of the {{notebook}} you are using.

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
