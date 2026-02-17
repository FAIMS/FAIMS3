# Entering Data

## Creating a Record

To create a new record from the **Record List**, tap or click the **+ ADD NEW MAIN** button.

## Entering Data

When you create a new record or edit an existing one, you will see a form similar to the screenshot shown here where you can enter your data:

```{screenshot} getting-started/record-form-mobile.png
:alt: Editing a {{Notebook}} record
:align: left
```

````{note}
The details of the form will depend on the configuration of the {{notebook}} you are using.
````
There are usually two tabs in a record form:

- **DATA** is where you will enter data, and
- **INFO** provides some information about the record such as the name of the person who created it and the creation time.   

There is a third tab that can appear if there are conflicts between versions of this record (see [Conflict Resolutions](./core/conflicts.md)).

How you fill our the form will vary will depend on the configuration of the {{notebook}} you are using.

{{FAIMS}} has a number of different _field types_ that you can interact with.

There will usually be a short help text along with each field and in some cases, longer help is available via an icon next to the field label.

### Parts of a Form

The form you are filling may have more than one _section_, as shown in the screenshot here where it is showing section 1 of 2 sections.  You can navigate between sections using the 'Next' and 'Back' links.

```{screenshot} getting-started/record-form-finish-buttons-mobile.png
:alt: Finishing a {{Notebook}} record
:align: right
```

As you complete the form and scroll to the end of the section, you will see the 'Finish' buttons as shown in this screenshot.   Above this, you may see a warning as shown here if there are errors in the form - generally if you have missed entering some data.
The error message should include a link that will scroll to the field that is missing.
If the error is in a different section of the form, it will link you to that section.

If the form has errors, you are still able to finish your edits, all of the data that you have entered will be saved and you can come back later to fix the errors.

The three buttons at the bottom of the form allow you to finalise the record you are creating or the edits you've made.

The **FINISH AND CLOSE ...** button will finalise all of your changes and update the saved
record. It will then return you to either the main record list or the parent record
if this is a child record (see below).

The **FINISH AND NEW ...** button will finalise the current record and start a new one
of the same type. This is useful if you are entering a series of observations.

The **CANCEL** button will cancel the current changes and return you to the record list
or the parent record.  It will first check that you are sure that you want to lose
the changes you have made.

### Annotations and Uncertainty

In the screenshots above you might notice the small blue icon below some fields. This indicates that the {{notebook}} field has been configured to allow annotations.

If you click on this icon you will be able to enter either a textual annotation or note, or check a box that might be labelled 'Uncertain' or something similar.  These annotations are in addition to the data you enter in the field and can be used to make a note about the data - for example that you were unable to take a measurement properly or that you are uncertain about the exact value. 

These annotations are then available alongside the actual data when it is exported from {{FAIMS}}.

For more on information on annotation and uncertainty see [Marginal data](docs\user\core\marginal-data). 