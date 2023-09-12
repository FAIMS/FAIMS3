/*
 * Copyright 2021, 2022 Macquarie University
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
 * Filename: record-create.test.tsx
 * Description:
 *   TODO
 */

import {act, cleanup, render, screen} from '@testing-library/react';
import {expect, vi, test, afterEach} from 'vitest';

import RecordCreate from './record-create';
import React from 'react';

const testProjectInfo = {
  created: 'Unknown',
  description: 'No description',
  is_activated: true,
  last_updated: 'Unknown',
  listing_id: 'default',
  name: 'Test Name',
  non_unique_project_id: 'unique-test-id',
  project_id: 'default||1685527104147-campus-survey-demo',
  status: 'published',
};

const testProjectUIModel = {
  fields: [],
  views: {},
  viewsets: {},
  visible_types: [],
};

function mockGetProjectInfo(project_id: string) {
  if (project_id) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(testProjectInfo);
      }, 300);
    });
  } else
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(undefined);
      }, 300);
    });
}

class mockPromiseState {
  expect() {
    return testProjectInfo;
  }
}

function mockUseEventedPromise() {
  return new mockPromiseState();
}

function mockGetFieldNamesFromFields() {
  return [
    'name',
    'pre_description',
    'project_lead',
    'lead_institution',
    'Sync',
  ];
}

function mockGetFieldsForViewSet() {
  return {
    name: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      meta: {
        annotation_label: 'annotation',
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
      access: ['admin'],
      'component-parameters': {
        name: 'name',
        id: 'name',
        variant: 'outlined',
        required: true,
        InputProps: {
          type: 'text',
          rows: 1,
        },
        fullWidth: true,
        helperText: 'Enter a string between 2 and 100 characters long',
        InputLabelProps: {
          label: 'Project Name',
        },
      },
      alert: false,
      validationSchema: [
        ['yup.string'],
        ['yup.min', 1, 'Too Short!'],
        ['yup.required'],
      ],
      initialValue: '',
    },
    pre_description: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      meta: {
        annotation_label: 'annotation',
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
      access: ['admin'],
      'component-parameters': {
        name: 'pre_description',
        id: 'pre_description',
        variant: 'outlined',
        required: true,
        InputProps: {
          type: 'text',
          rows: 4,
        },
        fullWidth: true,
        helperText: '',
        InputLabelProps: {
          label: 'Description',
        },
        multiline: true,
      },
      alert: false,
      validationSchema: [['yup.string'], ['yup.required']],
      initialValue: '',
    },
    project_lead: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      meta: {
        annotation_label: 'annotation',
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
      access: ['admin'],
      'component-parameters': {
        name: 'project_lead',
        id: 'project_lead',
        variant: 'outlined',
        required: false,
        InputProps: {
          type: 'text',
          rows: 1,
        },
        fullWidth: true,
        helperText: '',
        InputLabelProps: {
          label: 'Lead',
        },
        placeholder: '',
      },
      alert: false,
      validationSchema: [['yup.string']],
      initialValue: '',
    },
    lead_institution: {
      'component-namespace': 'formik-material-ui',
      'component-name': 'TextField',
      'type-returned': 'faims-core::String',
      meta: {
        annotation_label: 'annotation',
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
      access: ['admin'],
      'component-parameters': {
        name: 'lead_institution',
        id: 'lead_institution',
        variant: 'outlined',
        required: false,
        InputProps: {
          type: 'text',
          rows: 1,
        },
        fullWidth: true,
        helperText: '',
        InputLabelProps: {
          label: 'lead_institution',
        },
        placeholder: '',
      },
      alert: false,
      validationSchema: [['yup.string']],
      initialValue: '',
    },
    Sync: {
      'component-namespace': 'faims-custom',
      'component-name': 'Checkbox',
      'type-returned': 'faims-core::Bool',
      meta: {
        annotation_label: 'annotation',
        uncertainty: {
          include: false,
          label: 'uncertainty',
        },
      },
      access: ['admin'],
      'component-parameters': {
        name: 'Sync',
        id: 'Sync',
        variant: 'outlined',
        required: true,
        type: 'checkbox',
        FormControlLabelProps: {
          label: 'Automatic Updates',
        },
        FormHelperTextProps: {
          children:
            'Automatically save changes the user makes as they occur. Automatically retrieve changes made by other users every 30s (if online)',
        },
        disabled: true,
        value: true,
      },
      alert: false,
      validationSchema: [['yup.bool']],
      initialValue: true,
    },
  };
}

function mockGetUiSpecForProject(project_id: string) {
  if (project_id) {
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(testProjectUIModel);
      }, 300);
    });
  }
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(undefined);
    }, 300);
  });
}

afterEach(() => {
  cleanup();
});

vi.mock('react-router-dom', async () => {
  return {
    useParams: () => ({
      project_id: testProjectInfo.project_id,
      type_name: 'SurveyAreaForm',
    }),
    useLocation: () => ({
      pathname:
        '/notebooks/default%7C%7C1685527104147-campus-survey-demo/new/SurveyAreaForm',
      search: '',
      hash: '',
      state: null,
      key: 'survey-area-key',
    }),
    useNavigate: vi.fn(() => {}),
    Link: vi.fn(() => {}), // this prevents the project name appearing
    RouterLink: vi.fn(() => {}),
  };
});

vi.mock('../../databaseAccess', () => ({
  getProjectInfo: mockGetProjectInfo,
  listenProjectInfo: vi.fn(() => {}),
}));

vi.mock('../../uiSpecification', () => ({
  getUiSpecForProject: mockGetUiSpecForProject,
  getFieldsForViewSet: mockGetFieldsForViewSet,
  getFieldNamesFromFields: mockGetFieldNamesFromFields,
}));

vi.mock('../pouchHook', () => ({
  useEventedPromise: mockUseEventedPromise,
  constantArgsShared: vi.fn(() => {}),
}));

test('Check record create component', async () => {
  act(() => {
    render(<RecordCreate />);
  });

  //expect(screen.getByText(testProjectInfo.name)).toBeTruthy();
  expect(screen.getByText('Draft')).toBeTruthy();
});
