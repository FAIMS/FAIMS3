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
 * Filename: project-create.test.tsx
 * Description:
 *   TODO
 */

import {
  act,
  cleanup,
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import {expect, vi, afterEach, test} from 'vitest';

import ProjectCreate from './project-create';

const testProjectInfo = {
  created: 'Unknown',
  description: 'No description',
  is_activated: true,
  last_updated: 'Unknown',
  listing_id: 'default',
  name: 'Test Name',
  non_unique_project_id: 'unique-test-id',
  project_id: 'test-project-id',
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

vi.mock('react-router-dom', () => {
  return {
    useParams: () => ({
      project_id: testProjectInfo.project_id,
    }),

    useNavigate: vi.fn(() => {}),
  };
});

vi.mock('../../databaseAccess', () => ({
  getProjectInfo: mockGetProjectInfo,
}));

vi.mock('../../uiSpecification', () => ({
  getUiSpecForProject: mockGetUiSpecForProject,
  getFieldsForViewSet: mockGetFieldsForViewSet,
  getFieldNamesFromFields: mockGetFieldNamesFromFields,
}));

test('Check project create component', async () => {
  act(() => {
    render(<ProjectCreate />);
  });

  expect(screen.getByText('Preparing project for editing...')).toBeTruthy();

  await waitForElementToBeRemoved(() =>
    screen.getByText('Preparing project for editing...')
  );

  expect(screen.getByText(testProjectInfo.name)).toBeTruthy();

  expect(screen.getByText('Info')).toBeTruthy();

  expect(screen.getByText('Design')).toBeTruthy();

  expect(screen.getByText('Overview')).toBeTruthy();

  expect(screen.getByText('Preview')).toBeTruthy();

  expect(screen.getByText('Behaviour')).toBeTruthy();

  expect(screen.getByText('Submit')).toBeTruthy();
});
