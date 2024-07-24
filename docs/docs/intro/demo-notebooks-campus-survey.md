(demo-notebooks/demo-notebooks-campus-survey)=
# Demonstration Notebooks: Campus Survey

The *Campus-Demo-Notebook* is a simple workflow designed for a team of recorders to observe landscape elements and street furniture in a typical campus setting.

## Access

To access the survey go to <https://fieldmark.app/> on your browser.

Then:

* Sign in
* Choose the [<span class="material-icons">dashboard</span> Workspace]{.orange-button} button
* Activate `Campus-Survey-Demo` with the button [Activate]{.fieldmark-button} in the column labelled "Sync".
* Wait for the notebook to load
* Click on the Campus Survey Demo in the Activated notebook tab:

![workspace notebook list](/common-images/workspace_activated_localdraft.png)

(demo/campus/set-ranges)=
## Task 1: Setting ID ranges

The first task is setting parameters for the ID auto incrementors. This will allow each team to set starting and final ID numbers so that a unique sequence can be built across all the data collected. (This is a configurable setting and can be adjusted for each notebook.) To set the ID range:

1. Ensure you are in the notebook records list screen.

:::{image} demo-notebooks-campus-images/demo.3.faims.edu.au_notebooks_default%7C%7Ccampus_survey_demo.png
:::

1. Choose the [settings]{.blue-tab} tab.
1. Find the box labelled `Edit Allocations for Landscape Element <Description> AutoIncrementer`
1. Click [<span class="material-icons">add</span>Add New Range]{.fieldmark-button}
2.  Enter the range for your username, eg 0-49, 50-99:

| *Username*           | *Zone*  | *ID from* | *ID to* |
|----------------------|---------|-----------|---------|
| MQMarcusAgrippa      | Charlie | 1         | 49      |
| MQActus              | Charlie | 50        | 99      |
| MQTralles            | Charlie | 100       | 149     |
| MQIsidoreOfMiletus   | Charlie | 150       | 199     |
| MQApolloudiusOfDamas | Charlie | 200       | 249     |

3.  Click 'Update Range'.
4. You will see a {term}`Snackbar` notification with [Range Successfully Updated]{.green-snack}

## Task 2: Setting Survey Area

Each group will cover a ‘predetermined’ Survey area (Today, everyone will be using zone `charlie`) and enter some metadata before heading out into the field. To create a Survey Area record:

1.  Click on [<span class="material-icons">add</span>Survey Area]{.fieldmark-button} in the top right corner of the Notebook homepage
2.  You can begin to enter info (fictional or based on your observations) about the survey area:

:::{image} demo-notebooks-campus-images/in-record-demo.3.faims.edu.au_notebooks_default%7C%7Ccampus_survey_demo.png
:width: 70%
:align: center
:::

3.  Select Zone Charlie.
4.  Add a nickname (eg Eating Hall) to remember the area.
5.  Use the map view to draw a bounding polygon for the Survey Area.
6.  Tap [Take GPS Starting Point]{.fieldmark-button} to capture the point at which you commenced the survey.

:::{warning}
If you don't see [Take GPS Starting Point]{.fieldmark-button}, ensure you are in Zone Charlie
:::

7.  Make a Note if needed.
8.  You must click [Publish and close record]{.fieldmark-button} for the record to move from Drafts and be synchronized with other devices.

## Task 3: Data collection

Participants will head outside (if possible) and collect sample data.

You can create new Landscape Element records in two ways, either:


:::{warning}
If you get a {term}`Snack` bar/alert saying that [Failed to get autoincremented ID]{.red-snack} and "No ranges exist for this notebook yet. Go to the notebook Settings tab to add/edit ranges", you forgot to do task 1. Leave the record perform task 1.
:::

-   From the Survey Area {term}`Form`, by tapping [<span class="material-icons">add</span>Add Child Record]{.fieldmark-button}
-   From the Notebook homepage by tapping [<span class="material-icons">add</span>Landscape Element]{.fieldmark-button} (Note: Landscape elements added from the Notebook's homepage will not be linked to a Survey Area. To associate an existing Landscape element with a Survey Area, select [<span class="material-icons">expand_more</span>Add Link]{.fieldmark-button} inside a survey area in the Landscape Elements relationship field.)

You will see:

:::{image} demo-notebooks-campus-images/landscape-demo.3.faims.edu.au_notebooks_default%7C%7Ccampus_survey_demo.png
:width: 70%
:align: center
:::

Once you have identified a target for survey (a bench seat, lamp post or sign):

1.  Enter an Asset ID (fictional or based on your observations)
2.  Select an Element Type from the dropdown.
3.  Tap [Take GPS Point]{.fieldmark-button} to capture a GPS point.
4.  Enter the name or number of the Nearest building
5.  Select a Condition from the radio list
6.  If the condition is so poor that it is dangerous (tap the Dangerous checkbox)
7.  Tap [Take Photo]{.fieldmark-button} to take a photograph and the Camera will be called.
8.  Make a Note if needed.

## Data editing and review

Back in the Lab, go to <https://fieldmark.app/> and navigate to the *Campus-Survey-Demo*. Here you can search for all records that you have synchronized.

### Meta
To review record metadata tap on the [META]{.blue-tab} tab on a published record.:

:::{image} demo-notebooks-campus-images/meta-demo.3.faims.edu.au_notebooks_default%7C%7Ccampus_survey_demo.png
:width: 70%
:align: center
:::

### Delete a Record

To delete a record, select [<span class="material-icons">delete</span>DELETE RECORD]{.red-button} from the [META]{.blue-tab} tab.

:::{note}
No records are deleted, simply hidden from view. It is possible to undelete records with the command line.
:::

<link href="https://fonts.googleapis.com/icon?family=Material+Icons"
      rel="stylesheet">
