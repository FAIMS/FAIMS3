(advanced/identifiers)=
# Human Readable Identifiers

A human readable identifier is best edited directly in the JSON for any complexity beyond concatenating one or more fields with `-`. The syntax for the human readable identifier follows the [Mustache](https://mustache.github.io/mustache.5.html) spec, including conditionals.

:::{warning}
Do not change the field keys for HRIDs. They must always be of the form `hridFORM`N where N is the form number.
:::

The most complex example of a HRID presently in use is in the [CSIRO Geochemistry Water subsample](https://github.com/FAIMS/FAIMS3-notebook-CSIRO-geochemistry/blob/8acc827cea1d532cb3f45e681905da84d90d9c2d/csirogeochem.json#L2201):

```
"template": "pH: {{phNumericPhValue}}{{#phCheckboxPreferred}}, Preferred{{/phCheckboxPreferred}}; Eh: {{EhNumericValue}}{{#ehCheckboxPreferred}}, Preferred{{/ehCheckboxPreferred}}; DO: {{doTextValue}}{{#doCheckboxPreferred}}, Preferred{{/doCheckboxPreferred}}; {{phTimestamp}}",
```

Taking this in parts. 
* The key is `component-parameters`.`template` in the element type `"component-name": "TemplatedStringField",`
* A rendered HRID in its most complex form could look like `pH: 8, Preferred; Eh: 5, Preferred; DO: 30, Preferred; 2023-03-03T07:08:31.330Z`
* It starts with always-present static text `pH: `, 
* then gets the field value from the key `phNumericPhValue`

:::{note}
We recommend editing all keys to be useful keys instead of newfieldhexvalue, to make work like this easier.
:::

* Then it checks for the presence of the value phCheckboxPreferred, and if present, writes the static text `, Preferred`. 
* Then it always appends `; Eh: ` and the process repeats for the other values.

## Identifiers with autoincrementers

An autoincrementer, in the json, is merely a field. Use the field key as part of the template, as per the previous section, within `{{fieldKey}}`. 

Here is an example from CSIRO Geochemistry:

```
"hridFORM5":
{
    "component-namespace": "faims-custom",
    "component-name": "TemplatedStringField",
    "type-returned": "faims-core::String",
    "component-parameters":
    {
        "fullWidth": true,
        "name": "hridFORM5",
        "id": "hridFORM5",
        "helperText": "Soil ID",
        "variant": "filled",
        "required": false,
        "template": "{{soilCampaignLabel}}-S-{{soilAutoinc}}",
        "InputProps":
        {
            "type": "text",
            "readOnly": true
        },
        "InputLabelProps":
        {
            "label": "Soil ID"
        },
        "hrid": false,
        "linked": "newfield9d24c493",
        "fieldselect10": "soilAutoinc"
    },
    "validationSchema":
    [
        [
            "yup.string"
        ]
    ],
    "initialValue": "",
    "access":
    [
        "admin"
    ],
    "meta":
    {
        "annotation_label": "annotation",
        "annotation": false,
        "uncertainty":
        {
            "include": false,
            "label": "uncertainty"
        }
    }
},
"soilAutoinc":
{
    "component-namespace": "faims-custom",
    "component-name": "BasicAutoIncrementer",
    "type-returned": "faims-core::String",
    "component-parameters":
    {
        "name": "soilAutoinc",
        "id": "soilAutoinc",
        "variant": "outlined",
        "required": false,
        "num_digits": 5,
        "form_id": "FORM5SECTION1",
        "label": "Soil Autoincrementer"
    },
    "validationSchema":
    [
        [
            "yup.string"
        ]
    ],
    "initialValue": null,
    "access":
    [
        "admin"
    ],
    "meta":
    {
        "annotation_label": "annotation",
        "annotation": false,
        "uncertainty":
        {
            "include": false,
            "label": "uncertainty"
        }
    }
},

...
```


(advanced/notebook-creation-advanced)=
# Advanced Notebook Customisation

The following instructions provide information for advanced users to customise notebooks without the use of the Notebook Designer.

For an introduction to Fieldmark Notebooks see [Notebook Creation](intermediate/notebook-creation).


## **Hierarchical vocabularies**

A hierarchical vocabulary can save either its leaf node or the full path. Set the variable `valuetype` accordingly:

```
"valuetype": "child" #child
"valuetype": "full" #full path
```

Here is the specification for the hierarchical json: 

```
name: compulsory
children: compulsory
type: image (if image please set image as below example, if not just not set this key)
label: not compulsory #to show label for image, if not added, name will be used
```

Example 1, without images:

```
[
    {
        "name": "Colour",
        "children":
        [
            {
                "name": "Red",
                "children":
                []
            }
        ]
    },
    {
        "name": "Image",
        "children":
        [
            {
                "name": "MQ_logo",
                "children":
                []
            }
        ]
    }
]
```

### Hierarchical vocabularies with images

1.  Upload images in notebook designer Info > Attachments
2.  Click ‘Save Notebook’ button in Submit Tab
3.  Check if the image uploaded pop with ID in front of the image under ‘Files Attached’ list (if not, refresh the page)
4.  Get the ID (example: Attachment-29c68347) for the image and add it into the json field option
    

```
[
    {
        "name": "Colour",
        "children":
        [
            {
                "name": "Red",
                "children":
                []
            }
        ]
    },
    {
        "name": "Image",
        "children":
        [
            {
                "name": "Attachment-c0ec1672",
                "type": "image",
                "label": "MQ_logo",
                "children":
                [
                    {
                        "name": "Attachment-9b2b1348",
                        "type": "image",
                        "children":
                        []
                    }
                ]
            },
            {
                "name": "Attachment-29c68347",
                "type": "image",
                "children":
                []
            }
        ]
    }
]
```
:::{note}
**If attachments edited/added manually (not using above steps), please make sure values have been added into ‘project-metadata-attachfilenames’ meta data**, following example below. "Attachment-f8077299" and "Attachment-6e504881" are the attachment IDs
:::

```
{
    "is_attachment": false,
    "metadata":
    [
        "Attachment-f8077299",
        "Attachment-6e504881"
    ],
    "_doc_id_rev": "project-metadata-attachfilenames::2-ab86bb5d9a96d7bd31ad761d34bde04e"
}
```

### Worked example:

```
  "newfield44658d9c": {
      "component-namespace": "faims-custom",
      "component-name": "AdvancedSelect",
      "type-returned": "faims-core::String",
      "component-parameters": {
        "fullWidth": true,
        "helperText": "Hierarchical Vocab Deposit Type",
        "variant": "outlined",
        "required": false,
        "select": true,
        "InputProps": {},
        "SelectProps": {},
        "ElementProps": {
          "optiontree": [
            {
              "name": "No Observation",
              "children": []
            },
            {
              "name": "Attachment-Cut",
              "type": "image",
              "label": "Cut",
              "children": []
            },
            {
              "name": "Attachment-Structure",
              "type": "image",
              "label": "Structure",
              "children": []
            },
            {
              "name": "Natural/Bio",
              "children": [
                {
                  "name": "Attachment-Natural",
                  "type": "image",
                  "label": "Natural",
                  "children": []
                },
                {
                  "name": "Attachment-Skeleton",
                  "type": "image",
                  "label": "Skeleton",
                  "children": []
                }
              ]
            },
            {
              "name": "Attachment-Deposit",
              "type": "image",
              "label": "Deposit",
              "children": []
            }
          ]
        },
        "label": "Deposit Type",
        "valuetype": "full",
        "id": "newfield44658d9c",
        "name": "newfield44658d9c"
      },
      "validationSchema": [
        [
          "yup.string"
        ]
      ],
      "initialValue": "",
      "access": [
        "admin"
      ],
      "meta": {
        "annotation_label": "annotation",
        "annotation": true,
        "uncertainty": {
          "include": false,
          "label": "uncertainty"
        }
      }
    }
```

## Branching Logic

json **controller field**

```
"logic_select": {
        "type": [
          "field",
          "view"
        ]
      }
#type could be 
[ "field","section"]#control both views and fields
[ "field"]#control fields
[ "view"]#control views
```

Example:

```
"newfield800c3f33": {
      "component-namespace": "faims-custom",
      "component-name": "Select",
      "type-returned": "faims-core::String",
      "component-parameters": {
        "fullWidth": true,
        "helperText": "Choose a field from the dropdown",
        "variant": "outlined",
        "required": false,
        "select": true,
        "InputProps": {},
        "SelectProps": {},
        "ElementProps": {
          "options": [
            {
              "value": "1",
              "label": "1"
            },
            {
              "value": "2",
              "label": "2"
            }
          ]
        },
        "InputLabelProps": {
          "label": "Select Field"
        },
        "id": "newfield800c3f33",
        "name": "newfield800c3f33"
      },
      "validationSchema": [
        [
          "yup.string"
        ]
      ],
      "initialValue": "",
      "access": [
        "admin"
      ],
      "meta": {
        "annotation_label": "annotation",
        "annotation": true,
        "uncertainty": {
          "include": false,
          "label": "uncertainty"
        }
      },
      "logic_select": {
        "type": ["field"]
      }
    }
```

## Parent/Persistence data inheritance

```
# set to display in child record inheritance data 
"displayParent": true
# persistence data will be displayed in child record inheritance data as well
"persistent": true
```

example:

```
"newfieldb5763a2b": {
      "component-namespace": "formik-material-ui",
      "component-name": "TextField",
      "type-returned": "faims-core::String",
      "component-parameters": {
        "fullWidth": true,
        "helperText": "Helper Text",
        "variant": "outlined",
        "required": false,
        "InputProps": {
          "type": "text"
        },
        "SelectProps": {},
        "InputLabelProps": {
          "label": "Text Field"
        },
        "FormHelperTextProps": {},
        "id": "newfieldb5763a2b",
        "name": "newfieldb5763a2b"
      },
      "validationSchema": [
        [
          "yup.string"
        ]
      ],
      "initialValue": "",
      "access": [
        "admin"
      ],
      "meta": {
        "annotation_label": "annotation",
        "annotation": true,
        "uncertainty": {
          "include": false,
          "label": "uncertainty"
        }
      },
      "displayParent": true
    }
  }
```

## Implementing relationships

JSON spec to customise relationships:

```
#type of the relationship,
# compulsory, value could be "faims-core::Child" or "faims-core::Linked"
"relation_type": "faims-core::Child", 
# compulsory, link form ID
"related_type": "FORM2",
# compulsory, label for the link form, this value should be set as same as "related_type" label(e.g. FORM2 label), if not set, field list will display "related_type" value(e.g. FORM2)
"related_type_label": ""
#relationship link label:
"relation_linked_vocabPair":[
          [
            "is_above",
            "is below"
          ],
          [
            "is related",
            "is related to"
          ]
        ]
# compulsory, current form ID
"current_form": "FORM1",
# current form label, it will be used in field list, this value should be set as same as "current_form" label
"current_form_label": "Water Sample",
# this value should be ONLY set for "relation_type": "faims-core::Child", if set as '', Make column will not be displayed
"relation_preferred_label": "perfer"
```

Tips for "relation_linked_vocabPair" :

1.  For "relation_type": "faims-core::Child", default value is
    
    ```
    "relation_linked_vocabPair":[
                "is child of",
                "is parent of"
              ]
    ```
    
    If the value of linked_vocabPair is set, please use the same format.

    :::{warning}
    **Only set ONE array**, multiple array values will cause a display error.
    :::
    
2.  For "relation_type": "faims-core::Linked",several arrays can be added
    

```
# only one pair
"relation_linked_vocabPair":[
          [
            "is_above",
            "is below"
          ]
        ]
#several pairs
"relation_linked_vocabPair":[
          [
            "is_above",
            "is below"
          ],
          [
            "is related",
            "is related to"
          ]
        ]
```

### Example for "relation_type": "faims-core::Child"

```
"newfielddcc5a67e": {
      "component-namespace": "faims-custom",
      "component-name": "RelatedRecordSelector",
      "type-returned": "faims-core::Relationship",
      "component-parameters": {
        "fullWidth": true,
        "helperText": "Select or add new related record",
        "variant": "outlined",
        "required": true,
        "related_type": "FORM2",
        "relation_type": "faims-core::Child",
        "InputProps": {
          "type": "text"
        },
        "multiple": false,
        "SelectProps": {},
        "InputLabelProps": {
          "label": "PH "
        },
        "FormHelperTextProps": {},
        "id": "newfielddcc5a67e",
        "name": "newfielddcc5a67e",
        "related_type_label": "ph",
        "current_form": "FORM1",
        "current_form_label": "water",
        "relation_preferred_label": "Perfer"
      },
      "validationSchema": [
        [
          "yup.string"
        ],
        [
          "yup.required"
        ]
      ],
      "initialValue": "",
      "access": [
        "admin"
      ],
      "meta": {
        "annotation_label": "annotation",
        "annotation": true,
        "uncertainty": {
          "include": false,
          "label": "uncertainty"
        }
      }
    },
```

### Example for "relation_type": "faims-core::Linked"

```
"newfielda0c4eca4": {
      "component-namespace": "faims-custom",
      "component-name": "RelatedRecordSelector",
      "type-returned": "faims-core::Relationship",
      "component-parameters": {
        "fullWidth": true,
        "helperText": "Select or add new related record",
        "variant": "outlined",
        "required": true,
        "related_type": "FORM3",
        "relation_type": "faims-core::Linked",
        "InputProps": {
          "type": "text"
        },
        "multiple": true,
        "SelectProps": {},
        "InputLabelProps": {
          "label": "Select Related"
        },
        "FormHelperTextProps": {},
        "id": "newfielda0c4eca4",
        "name": "newfielda0c4eca4",
        "relation_linked_vocabPair": [
          [
            "is_above",
            "is below"
          ],
          [
            "is related",
            "is related to"
          ]
        ],
        "related_type_label": "plant",
        "current_form": "FORM1",
        "current_form_label": "water"
      },
      "validationSchema": [
        [
          "yup.string"
        ],
        [
          "yup.required"
        ]
      ],
      "initialValue": [],
      "access": [
        "admin"
      ],
      "meta": {
        "annotation_label": "annotation",
        "annotation": true,
        "uncertainty": {
          "include": false,
          "label": "uncertainty"
        }
      }
    }
```

## DateTimeNow Field

```
# set true :
#   When the record is first created, populate this field with the current datetime
"is_auto_pick": true 
```

example of DateTimeNow Field

```
"newfield6c54d8e2": {
      "component-namespace": "faims-custom",
      "component-name": "DateTimeNow",
      "type-returned": "faims-core::String",
      "component-parameters": {
        "fullWidth": true,
        "helperText": "Add a datetime stamp (click now to record the current date+time)",
        "variant": "outlined",
        "required": false,
        "InputLabelProps": {
          "label": "start time"
        },
        "is_auto_pick": true,
        "id": "newfield6c54d8e2",
        "name": "newfield6c54d8e2"
      },
      "validationSchema": [
        [
          "yup.string"
        ]
      ],
      "initialValue": "",
      "access": [
        "admin"
      ],
      "meta": {
        "annotation_label": "annotation",
        "annotation": true,
        "uncertainty": {
          "include": false,
          "label": "uncertainty"
        }
      }
    }
```