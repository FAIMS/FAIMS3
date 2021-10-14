#!/bin/sh

set -e

initialise_couchdb() {
    # setup directory with default
    local base_url="$1://$2:$3"
    local curl_cmd="curl -X PUT -u $4:$5"

    # setup directory
    $curl_cmd "$base_url/directory"
    $curl_cmd "$base_url/directory/default" -d "
      {
        \"_id\": \"default\",
        \"name\": \"Default instance\",
        \"description\": \"Default FAIMS instance\",
        \"auth_mechanisms\": {
          \"default\": {
            \"portal\": \"http://127.0.0.1:8080\",
            \"type\": \"oauth\",
            \"name\": \"Data Central\"
          }
        },
        \"projects_db\": {
          \"proto\": \"$1\",
          \"host\": \"$2\",
          \"port\": $3,
          \"lan\": true,
          \"db_name\": \"projects\"
        }
      }
    "

    # setup test_proj with default
    $curl_cmd "$base_url/projects"
    $curl_cmd "$base_url/projects/test_proj" -d "{
        \"_id\": \"test_proj\",
        \"name\": \"Test Project\",
        \"metadata_db\": {
          \"proto\": \"$1\",
          \"host\": \"$2\",
          \"port\": $3,
          \"lan\": true,
          \"db_name\": \"metadata-test_proj\"
        },
        \"data_db\": {
          \"proto\": \"$1\",
          \"host\": \"$2\",
          \"port\": $3,
          \"lan\": true,
          \"db_name\": \"data-test_proj\"
        }
    }"

    # setup directory with default
    $curl_cmd "$base_url/metadata-test_proj"
    $curl_cmd "$base_url/metadata-test_proj/ui-specification" -d "{
        \"_id\": \"ui-specification\",
        \"fields\": {
          \"bad-field\": {
            \"component-namespace\": \"fakefakefake\",
            \"component-name\": \"NotAComponent\",
            \"type-returned\": \"faims-core::Email\",
            \"component-parameters\": {
              \"fullWidth\": true,
              \"name\": \"email-field\",
              \"id\": \"email-field\",
              \"helperText\": \"Some helper text for email field\",
              \"variant\": \"outlined\",
              \"required\": true,
              \"InputProps\": {
                \"type\": \"email\"
              },
              \"SelectProps\": {},
              \"InputLabelProps\": {
                \"label\": \"Email Address\"
              },
              \"FormHelperTextProps\": {}
            },
            \"validationSchema\": [
              [
                \"yup.string\"
              ],
              [
                \"yup.email\",
                \"Enter a valid email\"
              ]
            ],
            \"initialValue\": \"\"
          },
          \"action-field\": {
            \"component-namespace\": \"faims-custom\",
            \"component-name\": \"ActionButton\",
            \"type-returned\": \"faims-core::String\",
            \"component-parameters\": {
              \"fullWidth\": true,
              \"name\": \"action-field\",
              \"id\": \"action-field\",
              \"helperText\": \"Enter a string between 2 and 50 characters long\",
              \"variant\": \"outlined\",
              \"required\": false,
              \"InputProps\": {
                \"type\": \"string\"
              },
              \"SelectProps\": {},
              \"InputLabelProps\": {
                \"label\": \"String Field Label\"
              },
              \"FormHelperTextProps\": {}
            },
            \"validationSchema\": [
              [
                \"yup.string\"
              ]
            ],
            \"initialValue\": \"hello\"
          },
          \"email-field\": {
            \"component-namespace\": \"formik-material-ui\",
            \"component-name\": \"TextField\",
            \"type-returned\": \"faims-core::Email\",
            \"component-parameters\": {
              \"fullWidth\": true,
              \"name\": \"email-field\",
              \"id\": \"email-field\",
              \"helperText\": \"Please provide a valid email address\",
              \"variant\": \"outlined\",
              \"required\": true,
              \"InputProps\": {
                \"type\": \"email\"
              },
              \"SelectProps\": {},
              \"InputLabelProps\": {
                \"label\": \"Email Address\"
              },
              \"FormHelperTextProps\": {}
            },
            \"validationSchema\": [
              [
                \"yup.string\"
              ],
              [
                \"yup.email\",
                \"Enter a valid email\"
              ],
              [
                \"yup.required\"
              ]
            ],
            \"initialValue\": \"\"
          },
          \"str-field\": {
            \"component-namespace\": \"formik-material-ui\",
            \"component-name\": \"TextField\",
            \"type-returned\": \"faims-core::String\",
            \"component-parameters\": {
              \"fullWidth\": true,
              \"name\": \"str-field\",
              \"id\": \"str-field\",
              \"helperText\": \"Enter a string between 2 and 50 characters long\",
              \"variant\": \"outlined\",
              \"required\": true,
              \"InputProps\": {
                \"type\": \"text\"
              },
              \"SelectProps\": {},
              \"InputLabelProps\": {
                \"label\": \"Favourite Colour\"
              },
              \"FormHelperTextProps\": {}
            },
            \"validationSchema\": [
              [
                \"yup.string\"
              ],
              [
                \"yup.min\",
                2,
                \"Too Short!\"
              ],
              [
                \"yup.max\",
                50,
                \"Too Long!\"
              ],
              [
                \"yup.required\"
              ]
            ],
            \"initialValue\": \"yellow\"
          },
          \"multi-str-field\": {
            \"component-namespace\": \"formik-material-ui\",
            \"component-name\": \"TextField\",
            \"type-returned\": \"faims-core::String\",
            \"component-parameters\": {
              \"fullWidth\": true,
              \"name\": \"multi-str-field\",
              \"id\": \"multi-str-field\",
              \"helperText\": \"Textarea help\",
              \"variant\": \"outlined\",
              \"required\": true,
              \"multiline\": true,
              \"InputProps\": {
                \"type\": \"text\",
                \"rows\": 4
              },
              \"SelectProps\": {},
              \"InputLabelProps\": {
                \"label\": \"Textarea Field Label\"
              },
              \"FormHelperTextProps\": {}
            },
            \"validationSchema\": [
              [
                \"yup.string\"
              ],
              [
                \"yup.required\"
              ]
            ],
            \"initialValue\": \"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.\"
          },
          \"int-field\": {
            \"component-namespace\": \"formik-material-ui\",
            \"component-name\": \"TextField\",
            \"type-returned\": \"faims-core::Integer\",
            \"component-parameters\": {
              \"fullWidth\": true,
              \"name\": \"int-field\",
              \"id\": \"int-field\",
              \"helperText\": \"Enter an integer between 0 and 20\",
              \"variant\": \"outlined\",
              \"required\": true,
              \"InputProps\": {
                \"type\": \"number\"
              },
              \"SelectProps\": {},
              \"InputLabelProps\": {
                \"label\": \"Integer Field Label\"
              },
              \"FormHelperTextProps\": {}
            },
            \"validationSchema\": [
              [
                \"yup.number\"
              ],
              [
                \"yup.positive\"
              ],
              [
                \"yup.integer\"
              ],
              [
                \"yup.min\",
                0,
                \"Min is 0\"
              ],
              [
                \"yup.max\",
                20,
                \"Max is 20\"
              ]
            ],
            \"initialValue\": 1
          },
          \"take-point-field\": {
            \"component-namespace\": \"faims-custom\",
            \"component-name\": \"TakePoint\",
            \"type-returned\": \"faims-pos::Location\",
            \"component-parameters\": {
              \"fullWidth\": true,
              \"name\": \"take-point-field\",
              \"id\": \"take-point-field\",
              \"helperText\": \"Get position\",
              \"variant\": \"outlined\"
            },
            \"validationSchema\": [
              [
                \"yup.object\"
              ],
              [
                \"yup.nullable\"
              ],
              [
                \"yup.shape\",
                {
                  \"latitude\": [
                    [
                      \"yup.number\"
                    ],
                    [
                      \"yup.required\"
                    ]
                  ],
                  \"longitude\": [
                    [
                      \"yup.number\"
                    ],
                    [
                      \"yup.required\"
                    ]
                  ]
                }
              ]
            ],
            \"initialValue\": null
          },
          \"select-field\": {
            \"component-namespace\": \"faims-custom\",
            \"component-name\": \"Select\",
            \"type-returned\": \"faims-core::String\",
            \"component-parameters\": {
              \"fullWidth\": true,
              \"name\": \"select-field\",
              \"id\": \"select-field\",
              \"helperText\": \"Choose a currency from the dropdown\",
              \"variant\": \"outlined\",
              \"required\": true,
              \"select\": true,
              \"InputProps\": {},
              \"SelectProps\": {},
              \"ElementProps\": {
                \"options\": [
                  {
                    \"value\": \"USD\",
                    \"label\": \"$\"
                  },
                  {
                    \"value\": \"EUR\",
                    \"label\": \"€\"
                  },
                  {
                    \"value\": \"BTC\",
                    \"label\": \"฿\"
                  },
                  {
                    \"value\": \"JPY\",
                    \"label\": \"¥\"
                  }
                ]
              },
              \"InputLabelProps\": {
                \"label\": \"Currency\"
              }
            },
            \"validationSchema\": [
              [
                \"yup.string\"
              ],
              [
                \"yup.required\",
                \"Currency is a required field\"
              ]
            ],
            \"initialValue\": \"\"
          },
          \"multi-select-field\": {
            \"component-namespace\": \"faims-custom\",
            \"component-name\": \"Select\",
            \"type-returned\": \"faims-core::String\",
            \"component-parameters\": {
              \"fullWidth\": true,
              \"name\": \"multi-select-field\",
              \"id\": \"multi-select-field\",
              \"helperText\": \"Choose multiple currencies from the dropdown\",
              \"variant\": \"outlined\",
              \"required\": true,
              \"select\": true,
              \"InputProps\": {},
              \"SelectProps\": {
                \"multiple\": true
              },
              \"InputLabelProps\": {
                \"label\": \"Currencies\"
              },
              \"FormHelperTextProps\": {
                \"children\": \"Choose multiple currencies\"
              },
              \"ElementProps\": {
                \"options\": [
                  {
                    \"value\": \"USD\",
                    \"label\": \"$\"
                  },
                  {
                    \"value\": \"EUR\",
                    \"label\": \"€\"
                  },
                  {
                    \"value\": \"BTC\",
                    \"label\": \"฿\"
                  },
                  {
                    \"value\": \"JPY\",
                    \"label\": \"¥\"
                  }
                ]
              }
            },
            \"validationSchema\": [
              [
                \"yup.string\"
              ],
              [
                \"yup.required\",
                \"Currencies is a required field\"
              ]
            ],
            \"initialValue\": []
          },
          \"checkbox-field\": {
            \"component-namespace\": \"faims-custom\",
            \"component-name\": \"Checkbox\",
            \"type-returned\": \"faims-core::Bool\",
            \"component-parameters\": {
              \"name\": \"checkbox-field\",
              \"id\": \"checkbox-field\",
              \"required\": true,
              \"type\": \"checkbox\",
              \"FormControlLabelProps\": {
                \"label\": \"Terms and Conditions\"
              },
              \"FormHelperTextProps\": {
                \"children\": \"Read the terms and conditions carefully.\"
              }
            },
            \"validationSchema\": [
              [
                \"yup.bool\"
              ],
              [
                \"yup.oneOf\",
                [
                  true
                ],
                \"You must accept the terms and conditions\"
              ],
              [
                \"yup.required\"
              ]
            ],
            \"initialValue\": false
          },
          \"radio-group-field\": {
            \"component-namespace\": \"faims-custom\",
            \"component-name\": \"RadioGroup\",
            \"type-returned\": \"faims-core::String\",
            \"component-parameters\": {
              \"name\": \"radio-group-field\",
              \"id\": \"radio-group-field\",
              \"variant\": \"outlined\",
              \"required\": true,
              \"ElementProps\": {
                \"options\": [
                  {
                    \"value\": \"1\",
                    \"label\": \"1\"
                  },
                  {
                    \"value\": \"2\",
                    \"label\": \"2\"
                  },
                  {
                    \"value\": \"3\",
                    \"label\": \"3\"
                  },
                  {
                    \"value\": \"4\",
                    \"label\": \"4\"
                  }
                ]
              },
              \"FormLabelProps\": {
                \"children\": \"Pick a number\"
              },
              \"FormHelperTextProps\": {
                \"children\": \"Make sure you choose the right one!\"
              }
            },
            \"initialValue\": \"3\"
          }
        },
        \"fviews\": {
          \"start-view\": {
            \"fields\": [
              \"take-point-field\",
              \"bad-field\",
              \"action-field\",
              \"email-field\",
              \"str-field\",
              \"multi-str-field\",
              \"int-field\",
              \"select-field\",
              \"multi-select-field\",
              \"checkbox-field\",
              \"radio-group-field\"
            ]
          },
          \"next-view\": \"another-view-id\",
          \"next-view-label\": \"Done!\"
        },
        \"start_view\": \"start-view\"
    }"

    # setup datadb with default
    $curl_cmd "$base_url/data-test_proj"

    $curl_cmd -H 'Content-Type: application/json' "$base_url/directory/_security" -d '{"admins": { "names": [], "roles": [] }, "members": { "names": [], "roles": [] } }'
    $curl_cmd -H 'Content-Type: application/json' "$base_url/projects/_security" -d '{"admins": { "names": [], "roles": [] }, "members": { "names": [], "roles": [] } }'
    $curl_cmd -H 'Content-Type: application/json' "$base_url/metadata-test_proj/_security" -d '{"admins": { "names": [], "roles": [] }, "members": { "names": [], "roles": [] } }'
    $curl_cmd -H 'Content-Type: application/json' "$base_url/data-test_proj/_security" -d '{"admins": { "names": [], "roles": [] }, "members": { "names": [], "roles": [] } }'
}
