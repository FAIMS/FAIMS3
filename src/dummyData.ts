/*
 * Copyright 2021 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: dummyData.ts
 * Description:
 *   TODO
 */

import {setUiSpecForProject} from './uiSpecification';
import {
  ActiveDoc,
  ListingsObject,
  ProjectMetaObject,
  ProjectObject,
  ProjectsList,
} from './datamodel/database';
import {Record, ProjectUIModel} from './datamodel/ui';
import {setProjectMetadata} from './projectMetadata';
import {upsertFAIMSData} from './data_storage';

const example_records: {
  [key: string]: Record[];
} = {
  default_astro_sky: [
    {
      record_id: '020948f4-79b8-435f-9db6-9c8ec7deab0a',
      revision_id: null,
      type: '??:??',
      created: randomDate(new Date(2012, 0, 1), new Date()),
      created_by: 'John Smith',
      updated: randomDate(new Date(2021, 0, 1), new Date()),
      updated_by: 'Yoda',
      data: {
        'take-point-field': {latitude: -33.7964844, longitude: 151.1456739},
        'bad-field': '',
        'action-field': 'hello',
        'email-field': 'MY-EMAIL-ADDRESS@example.com',
        'str-field': 'blurple',
        'multi-str-field':
          'Warning: This is modified from the direct output of the submit button to workaround select-field outputting a string, inputting an array.',
        'int-field': 20,
        'select-field': ['EUR'],
        'multi-select-field': ['JPY'],
        'checkbox-field': true,
        'radio-group-field': '1',
      },
    },
    {
      record_id: '020948f4-79b8-435f-9db6-9clksjdf900a',
      revision_id: null,
      type: '??:??',
      created: randomDate(new Date(2012, 0, 1), new Date()),
      created_by: 'John Smith',
      updated: randomDate(new Date(2021, 0, 1), new Date()),
      updated_by: 'Yoda',
      data: {
        'take-point-field': {latitude: -33.7964844, longitude: 151.1456739},
        'bad-field': '',
        'action-field': 'hello',
        'email-field': 'MY-EMAIL-ADDRESS@example.com',
        'str-field': 'green',
        'multi-str-field':
          'Warning: This is modified from the direct output of the submit button to workaround select-field outputting a string, inputting an array.',
        'int-field': 20,
        'select-field': ['EUR'],
        'multi-select-field': ['JPY'],
        'checkbox-field': true,
        'radio-group-field': '1',
      },
    },
  ],
};

function randomDate(start: Date, end: Date) {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime())
  );
}

const example_ui_specs: {[key: string]: ProjectUIModel} = {
  default_astro_sky: {
    fields: {
      'bad-field': {
        'component-namespace': 'fakefakefake', // this says what web component to use to render/acquire value from
        'component-name': 'NotAComponent',
        'type-returned': 'faims-core::Email', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'email-field',
          id: 'email-field',
          helperText: 'Some helper text for email field',
          variant: 'outlined',
          required: true,
          InputProps: {
            type: 'email',
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Email Address',
          },
          FormHelperTextProps: {},
        },
        validationSchema: [
          ['yup.string'],
          ['yup.email', 'Enter a valid email'],
        ],
        initialValue: '',
      },
      'action-field': {
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'ActionButton',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'action-field',
          id: 'action-field',
          helperText: 'Enter a string between 2 and 50 characters long',
          variant: 'outlined',
          required: false,
          InputProps: {
            type: 'string',
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'String Field Label',
          },
          FormHelperTextProps: {},
        },
        validationSchema: [['yup.string']],
        initialValue: 'hello',
      },
      'email-field': {
        'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
        'component-name': 'TextField',
        'type-returned': 'faims-core::Email', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'email-field',
          id: 'email-field',
          helperText: 'Please provide a valid email address',
          variant: 'outlined',
          required: true,
          InputProps: {
            type: 'email',
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Email Address',
          },
          FormHelperTextProps: {},
        },
        validationSchema: [
          ['yup.string'],
          ['yup.email', 'Enter a valid email'],
          ['yup.required'],
        ],
        initialValue: '',
      },
      'str-field': {
        'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
        'component-name': 'TextField',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'str-field',
          id: 'str-field',
          helperText: 'Enter a string between 2 and 50 characters long',
          variant: 'outlined',
          required: true,
          InputProps: {
            type: 'text', // must be a valid html type
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Favourite Colour',
          },
          FormHelperTextProps: {},
        },
        validationSchema: [
          ['yup.string'],
          ['yup.min', 2, 'Too Short!'],
          ['yup.max', 50, 'Too Long!'],
          ['yup.required'],
        ],
        initialValue: 'yellow',
      },
      'multi-str-field': {
        'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
        'component-name': 'TextField',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'multi-str-field',
          id: 'multi-str-field',
          helperText: 'Textarea help',
          variant: 'outlined',
          required: true,
          multiline: true,
          InputProps: {
            type: 'text',
            rows: 4,
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Textarea Field Label',
          },
          FormHelperTextProps: {},
        },
        validationSchema: [['yup.string'], ['yup.required']],
        initialValue:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
      },
      'int-field': {
        'component-namespace': 'formik-material-ui', // this says what web component to use to render/acquire value from
        'component-name': 'TextField',
        'type-returned': 'faims-core::Integer', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'int-field',
          id: 'int-field',
          helperText: 'Enter an integer between 0 and 20',
          variant: 'outlined',
          required: true,
          InputProps: {
            type: 'number',
          },
          SelectProps: {},
          InputLabelProps: {
            label: 'Integer Field Label',
          },
          FormHelperTextProps: {},
        },
        validationSchema: [
          ['yup.number'],
          ['yup.positive'],
          ['yup.integer'],
          ['yup.min', 0, 'Min is 0'],
          ['yup.max', 20, 'Max is 20'],
        ],
        initialValue: 1,
      },
      'take-point-field': {
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'TakePoint',
        'type-returned': 'faims-pos::Location', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'take-point-field',
          id: 'take-point-field',
          helperText: 'Get position',
          variant: 'outlined',
        },
        validationSchema: [
          ['yup.object'],
          ['yup.nullable'],
          [
            'yup.shape',
            {
              latitude: [['yup.number'], ['yup.required']],
              longitude: [['yup.number'], ['yup.required']],
            },
          ],
        ],
        initialValue: null,
      },
      'select-field': {
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'select-field',
          id: 'select-field',
          helperText: 'Choose a currency from the dropdown',
          variant: 'outlined',
          required: true,
          select: true,
          InputProps: {},
          SelectProps: {},
          ElementProps: {
            options: [
              {
                value: 'USD',
                label: '$',
              },
              {
                value: 'EUR',
                label: '€',
              },
              {
                value: 'BTC',
                label: '฿',
              },
              {
                value: 'JPY',
                label: '¥',
              },
            ],
          },
          InputLabelProps: {
            label: 'Currency',
          },
        },
        validationSchema: [
          ['yup.string'],
          ['yup.required', 'Currency is a required field'],
        ],
        initialValue: '',
      },
      'multi-select-field': {
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Select',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
          fullWidth: true,
          name: 'multi-select-field',
          id: 'multi-select-field',
          helperText: 'Choose multiple currencies from the dropdown',
          variant: 'outlined',
          required: true,
          select: true,
          InputProps: {},
          SelectProps: {
            multiple: true,
          },
          InputLabelProps: {
            label: 'Currencies',
          },
          FormHelperTextProps: {children: 'Choose multiple currencies'},
          ElementProps: {
            options: [
              {
                value: 'USD',
                label: '$',
              },
              {
                value: 'EUR',
                label: '€',
              },
              {
                value: 'BTC',
                label: '฿',
              },
              {
                value: 'JPY',
                label: '¥',
              },
            ],
          },
        },
        validationSchema: [
          ['yup.string'],
          ['yup.required', 'Currencies is a required field'],
        ],
        initialValue: [],
      },
      'checkbox-field': {
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'Checkbox',
        'type-returned': 'faims-core::Bool', // matches a type in the Project Model
        'component-parameters': {
          name: 'checkbox-field',
          id: 'checkbox-field',
          required: true,
          type: 'checkbox',
          FormControlLabelProps: {
            label: 'Terms and Conditions',
          },
          FormHelperTextProps: {
            children: 'Read the terms and conditions carefully.',
          },
          // Label: {label: 'Terms and Conditions'},
        },
        validationSchema: [
          ['yup.bool'],
          ['yup.oneOf', [true], 'You must accept the terms and conditions'],
          ['yup.required'],
        ],
        initialValue: false,
      },
      'radio-group-field': {
        'component-namespace': 'faims-custom', // this says what web component to use to render/acquire value from
        'component-name': 'RadioGroup',
        'type-returned': 'faims-core::String', // matches a type in the Project Model
        'component-parameters': {
          name: 'radio-group-field',
          id: 'radio-group-field',
          variant: 'outlined',
          required: true,
          ElementProps: {
            options: [
              {
                value: '1',
                label: '1',
                RadioProps: {
                  id: 'radio-group-field-1',
                },
              },
              {
                value: '2',
                label: '2',
                RadioProps: {
                  id: 'radio-group-field-2',
                },
              },
              {
                value: '3',
                label: '3',
                RadioProps: {
                  id: 'radio-group-field-3',
                },
              },
              {
                value: '4',
                label: '4',
                RadioProps: {
                  id: 'radio-group-field-4',
                },
              },
            ],
          },
          FormLabelProps: {
            children: 'Pick a number',
          },
          FormHelperTextProps: {
            children: 'Make sure you choose the right one!',
          },
        },
        // validationSchema: [['yup.number'], ['yup.lessThan', 2]],
        initialValue: '3',
      },
    },
    views: {
      'start-view': {
        fields: [
          'take-point-field',
          'bad-field',
          'action-field',
          'email-field',
          'str-field',
          'multi-str-field',
          'int-field',
          'select-field',
          'multi-select-field',
          'checkbox-field',
          'radio-group-field',
          // 'bool-field',
          // 'date-field',
          // 'time-field',
        ], // ordering sets appearance order
      },
      'next-view': 'another-view-id', // either this gets handled by a component, or we stick it here
      'next-view-label': 'Done!',
    },

    start_view: 'start-view',
  },
  default_projectB: {
    fields: {},
    views: {
      'start-view': {
        fields: [
          // 'email-field',
          // 'str-field',
          // 'int-field',
          // 'bool-field',
          // 'date-field',
          // 'time-field',
        ], // ordering sets appearance order
      },
      'next-view': 'another-view-id', // either this gets handled by a component, or we stick it here
      'next-view-label': 'Done!',
    },
    start_view: 'start-view',
  },
  default_projectC: {
    fields: {},
    views: {
      'start-view': {
        fields: [
          // 'email-field',
          // 'str-field',
          // 'int-field',
          // 'bool-field',
          // 'date-field',
          // 'time-field',
        ], // ordering sets appearance order
      },
      'next-view': 'another-view-id', // either this gets handled by a component, or we stick it here
      'next-view-label': 'Done!',
    },
    start_view: 'start-view',
  },
};

const example_listings: {[listing_id: string]: ProjectObject[]} = {
  default: [
    {
      name: 'AsTRoSkY - (Test Project)',
      data_db: {
        proto: 'http',
        host: '10.80.11.44',
        port: 5984,
        lan: true,
        db_name: 'astro_sky',
      },
      description: 'AsTRoSkY Test Project',
      _id: 'astro_sky',
    },
    {
      name: "Example Project 'A'",
      metadata_db: {
        proto: 'http',
        host: '10.80.11.44',
        port: 5984,
        lan: true,
        db_name: 'metadata-projectb',
      },
      description: "Example Project 'A'",
      _id: 'projectB',
    },
  ],
};

const example_directory: ListingsObject[] = [
  {
    _id: 'default',
    name: 'AAO Internal FAIMS instance',
    description:
      'This FAIMS server is the instance used internally by the AAO for testing.',
    people_db: {
      proto: 'http',
      host: '10.80.11.44',
      port: 5984,
      lan: true,
      db_name: 'people',
    },
    projects_db: {
      proto: 'http',
      host: '10.80.11.44',
      port: 5984,
      lan: true,
      db_name: 'projects',
    },
  },
  {
    _id: 'csiro',
    name:
      'Test of an independently hosted CouchDB Instance (People DB not implemented yet)',
    description:
      'This FAIMS server is the instance used internally by the AAO for testing.',
    people_db: {
      proto: 'http',
      host: '10.80.11.44',
      port: 5984,
      lan: true,
      db_name: 'people',
    },
    projects_db: {
      proto: 'http',
      host: '10.80.11.44',
      port: 5984,
      lan: true,
      db_name: 'csiro_hosted_projects',
    },
  },
];

const example_active_db: ActiveDoc[] = [
  {
    _id: 'default_astro_sky',
    listing_id: 'default',
    project_id: 'astro_sky',
    username: 'test1',
    password: 'apple',
    is_sync: true,
  },
  {
    _id: 'csiro_notparkes',
    listing_id: 'csiro',
    project_id: 'notparkes',
    username: 'test1',
    password: 'apple',
    is_sync: true,
  },
  {
    _id: 'default_projectA',
    listing_id: 'default',
    project_id: 'projectA',
    username: 'test1',
    password: 'apple',
    is_sync: true,
  },
  {
    _id: 'default_projectB',
    listing_id: 'default',
    project_id: 'projectB',
    username: 'test1',
    password: 'apple',
    is_sync: true,
  },
  {
    _id: 'default_projectC',
    listing_id: 'default',
    project_id: 'projectC',
    username: 'test1',
    password: 'apple',
    is_sync: true,
  },
];

const example_project_metadata: {[key: string]: string} = {
  project_lead: "Robert'); DROP TABLE Students;--",
  lead_institution: 'אוניברסיטת בן-גוריון בנגב',
};

export async function setupExampleDirectory(
  directory_db: PouchDB.Database<ListingsObject>
) {
  // For every project in the example_listings, insert into the projects db
  for (const listings_object of example_directory) {
    let current_rev: {_rev?: undefined | string} = {};
    try {
      current_rev = {_rev: (await directory_db.get(listings_object._id))._rev};
    } catch (err) {
      if (err.message !== 'missing') {
        //.reason may be 'deleted' or 'missing'
        throw err;
      }
      // Not in the DB means _rev is unnecessary for put()
    }
    await directory_db.put({...listings_object, ...current_rev});
  }

  const ids = example_directory.map(doc => doc._id);

  // Remove anything not supposed to be there
  for (const row of (await directory_db.allDocs()).rows) {
    if (ids.indexOf(row.id) < 0) {
      await directory_db.remove(row.id, row.value.rev);
    }
  }
}

export async function setupExampleActive(
  active_db: PouchDB.Database<ActiveDoc>
) {
  for (const doc of example_active_db) {
    let current_rev: {_rev?: undefined | string} = {};
    try {
      current_rev = {_rev: (await active_db.get(doc._id))._rev};
    } catch (err) {
      if (err.message !== 'missing') {
        //.reason may be 'deleted' or 'missing'
        throw err;
      }
      // Not in the DB means _rev is unnecessary for put()
    }
    await active_db.put({...doc, ...current_rev});
  }

  const ids = example_active_db.map(doc => doc._id);

  // Remove anything not supposed to be there
  for (const row of (await active_db.allDocs()).rows) {
    if (ids.indexOf(row.id) < 0) {
      await active_db.remove(row.id, row.value.rev);
    }
  }
}

export async function setupExampleListing(
  listing_id: string,
  projects_db: PouchDB.Database<ProjectObject>
) {
  if (!(listing_id in example_listings)) {
    return;
  }

  // For every project in the example_listings, insert into the projects db
  for (const project of example_listings[listing_id]) {
    let current_rev: {_rev?: undefined | string} = {};
    try {
      current_rev = {_rev: (await projects_db.get(project._id))._rev};
    } catch (err) {
      if (err.message !== 'missing') {
        //.reason may be 'deleted' or 'missing'
        throw err;
      }
      // Not in the DB means _rev is unnecessary for put()
    }
    await projects_db.put({...project, ...current_rev});
  }

  const ids = example_listings[listing_id].map(doc => doc._id);

  // Remove anything not supposed to be there
  for (const row of (await projects_db.allDocs()).rows) {
    if (ids.indexOf(row.id) < 0) {
      await projects_db.remove(row.id, row.value.rev);
    }
  }
}

export async function setupExampleData(projname: string) {
  if (projname in example_records) {
    for (const obs of example_records[projname]) {
      try {
        await upsertFAIMSData(projname, obs);
      } catch (err) {
        console.error('databases needs cleaning...');
        console.debug(err);
      }
    }
  }
}

export async function setupExampleProjectMetadata(
  projname: string,
  meta_db: PouchDB.Database<ProjectMetaObject>
) {
  const example_ui_spec = example_ui_specs[projname];
  if (example_ui_spec === undefined) {
    console.error(`Unable to find example_ui_spec for ${projname}`);
  } else {
    try {
      console.log(await setUiSpecForProject(meta_db, example_ui_spec));
    } catch (err) {
      console.error('databases needs cleaning...');
      console.debug(err);
    }
    for (const key in example_project_metadata) {
      try {
        await setProjectMetadata(projname, key, example_project_metadata[key]);
      } catch (err) {
        console.error('databases needs cleaning...');
        console.debug(err);
      }
    }
  }
}

export const dummy_projects: ProjectsList = {
  '1': {
    _id: '1',
    name: 'Project One',
    last_updated: 'September 14, 2019',
    created: '1/02/2021',
    status: 'active',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
  },
  '2': {
    _id: '2',
    name: 'Terrific Project Two',
    last_updated: 'September 10, 2020',
    created: '1/01/2019',
    status: 'closed',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
  },
  '3': {
    _id: '3',
    name: 'Longer Title Field Trip Project Title',
    last_updated: 'Jan 14, 2021',
    created: '1/01/2019',
    status: 'closed',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. ',
  },
};
