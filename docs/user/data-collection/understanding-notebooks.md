# Understanding the parts of a {{Notebook}}

A {{FAIMS}} {{Notebook}} is comprised of _Forms_ which can be divided into _Sections_. _Fields_ and other _Components_ are placed on each _Section_, in the order determined by the {{Notebook}} Creator.

## Forms

_Forms_ are highest level of organisation within a {{Notebook}}.

They are best understood as an _Entity_ in traditional data modelling and should describe the subject (or one of the subjects) of your recording project. For example, a site, feature and artefact would each have their own _Form_.  

On export, a .csv or spreadsheet will be created for each _Form_.

Within {{FAIMS}} you will be able to add a _Record_ for each _Form_ you create in the App.

In the [Demo Notebook](./core/demo-notebooks-demo.md), _Thing 1_ and _Thing 2_ are _Forms_:      

```{screenshot} demo/demo-notebook-forms.png
:alt: Forms in the Demo Notebook
:align: right
```

## Sections

_Sections_ are defined parts of a _Forms_.

They do not affect the output of data for that _Form_ but allow the {{Notebook}} Creator to break up the different _Fields_ and _Components_ into discreet views that allow researchers to capture data in the most efficient way.

In the [Demo Notebook](./core/demo-notebooks-demo.md), there are six _Sections_ within the _Form_ for Thing 1 that appears as tabs across the top of the screen:

```{screenshot} demo/demo-notebook-sections.png
:alt: Sections in the Demo Notebook
:align: right
```

## Records

_Records_ are the primary organising unit for observations made in {{FAIMS}}. A _Record_ is created for each _Form_ and together they will be exported into a single table or .csv. A record will include one or more _Fields_.

````{note}
Records can be *related* to each other using the [Relationships](../field-types/related-records.md) field type. See [Child and Related Records](related-records.md) for more information.
````

See [Record and field types](../field-types/field-record-types.md) for an overview of Field Types.
