
export function lookupFAIMSType(faimsType: string) {
    return {};
}

export function getUiSpecForProject(project_name: string) {
    return {
        "fields": {
            "int-field": {
              "label": "A helpful label",
              "component-namespace": "core-material-ui", // this says what web component to use to render/aquire value from
              "component-name": "Input",
              "type-returned": "faims-core::Integer", // matches a type in the Project Model
              "documentation": "<p>Some HTML</p>", // the documentation on the field
              "component-parameters": {
                "type": "number",
              } // configure appearance/actions/etc. of component
            },
            "str-field": {
              "label": "A helpful label",
              "component-namespace": "core-material-ui", // this says what web component to use to render/aquire value from
              "component-name": "Input",
              "type-returned": "faims-core::Integer", // matches a type in the Project Model
              "documentation": "<p>Some HTML</p>", // the documentation on the field
              "component-parameters": {
                "type": "string",
              } // configure appearance/actions/etc. of component
            },
            "bool-field": {
              "label": "A helpful label",
              "component-namespace": "core-material-ui", // this says what web component to use to render/aquire value from
              "component-name": "Checkbox",
              "type-returned": "faims-core::Integer", // matches a type in the Project Model
              "documentation": "<p>Some HTML</p>", // the documentation on the field
              "component-parameters": {
              } // configure appearance/actions/etc. of component
            },
            "date-field": {
              "label": "A helpful label",
              "component-namespace": "core-material-ui", // this says what web component to use to render/aquire value from
              "component-name": "TextField",
              "type-returned": "faims-core::Integer", // matches a type in the Project Model
              "documentation": "<p>Some HTML</p>", // the documentation on the field
              "component-parameters": {
                "type": "date",
              } // configure appearance/actions/etc. of component
            },
            "time-field": {
              "label": "A helpful label",
              "component-namespace": "core-material-ui", // this says what web component to use to render/aquire value from
              "component-name": "TextField",
              "type-returned": "faims-core::Integer", // matches a type in the Project Model
              "documentation": "<p>Some HTML</p>", // the documentation on the field
              "component-parameters": {
                "type": "time",
              } // configure appearance/actions/etc. of component
            },
        },
        "views": {
            "start-view": {
                "fields": [
                    "int-field",
                    "str-field",
                    "bool-field",
                    "date-field",
                    "time-field",
                ], // ordering sets appearance order
                //"next-view": "another-view-id", // either this gets handled by a component, or we stick it here
                //"next-view-label": "Done!"
            }
        },
        "start-view": "start-view",
    };
}
