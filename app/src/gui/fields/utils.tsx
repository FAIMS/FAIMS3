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
 * Filename: utils.tsx
 * Description:
 *   TODO
 */

import {vi} from 'vitest';

const testUser: ActiveUser = {
  username: 'testUser',
  serverId: 'test-server',
  token: 'foo',
  parsedToken: {
    username: 'testUser',
    server: 'test-server',
    exp: 0,
    resourceRoles: [],
    globalRoles: [],
  },
  expiresAt: 0,
};

const testProject = {
  created: 'Unknown',
  description: 'No description',
  is_activated: true,
  last_updated: 'Unknown',
  listing_id: 'default',
  name: 'Test Name',
  project_id: 'test-project',
  status: 'published',
  metadata: {name: 'Test Name'},
};

//    state => state.projects.servers[serverId]?.projects[projectId]
const mockState = {
  projects: {
    servers: {
      'test-server': {
        projects: {
          'test-project': testProject,
        },
      },
    },
  },
  records: {
    edited: false,
  },
  auth: {
    activeUser: testUser,
    servers: {
      'test-server': {
        users: {
          testUser,
        },
      },
    },
  },
};

// Mock just the store with getState method
vi.mock('../../context/store', () => ({
  store: {
    getState: vi.fn(() => mockState),
    dispatch: vi.fn(),
    subscribe: vi.fn(() => vi.fn()), // subscribe returns unsubscribe function
  },
  useAppDispatch: () => vi.fn(),
  useAppSelector: vi.fn(fn => fn(mockState)),
}));

// Mock React DOM createRoot to prevent DOM mounting during tests
vi.mock('react-dom/client', () => ({
  default: {
    createRoot: vi.fn(() => ({
      render: vi.fn(),
      unmount: vi.fn(),
    })),
  },
}));

// Mock the authSlice
vi.mock('../../../context/slices/authSlice', () => ({
  // Mock the selector
  selectActiveUser: vi.fn(() => ({
    serverId: 'test-server',
    username: 'testuser',
    token: 'test-token',
    parsedToken: {
      username: 'testuser',
      exp: Date.now() / 1000 + 3600, // expires in 1 hour
    },
    expiresAt: Date.now() / 1000 + 3600,
  })),

  // Mock other selectors that might be used
  selectIsAuthenticated: vi.fn(() => true),
  selectActiveToken: vi.fn(() => ({
    token: 'test-token',
    refreshToken: 'test-refresh-token',
    parsedToken: {
      username: 'testuser',
      exp: Date.now() / 1000 + 3600,
    },
    expiresAt: Date.now() / 1000 + 3600,
  })),

  // Mock action creators
  setActiveUser: vi.fn(),
  removeServerConnection: vi.fn(),
  clearActiveConnection: vi.fn(),
  refreshIsAuthenticated: vi.fn(),
  assignServerConnection: vi.fn(),
  setServerConnection: vi.fn(),
  refreshToken: vi.fn(),
  refreshActiveUser: vi.fn(),
  refreshAllUsers: vi.fn(),

  // Mock other exports as needed
  isTokenValid: vi.fn(() => true),
}));

import React from 'react';
import {getComponentFromFieldConfig} from '../components/record/fields';
import {render} from '@testing-library/react';
import {Formik, FormikConfig, FormikProps} from 'formik';
import {configureStore} from '@reduxjs/toolkit';
import {Provider} from 'react-redux';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {ThemeProvider} from '@mui/material/styles';
import testTheme from '../../gui/themes/default';
import {ActiveUser} from '../../context/slices/authSlice';
import {Router} from 'react-router-dom';

// Mock notification context
const mockNotificationContext = {
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  showInfo: vi.fn(),
};

// You'll need to import or mock the NotificationContext
const NotificationContext = React.createContext(mockNotificationContext);

// Test wrapper component
export const TestWrapper: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const testStore = configureStore({
    reducer: {
      // Add the reducers your components actually need
      // Check your main store configuration for reference
    },
  });

  const queryClient = new QueryClient();

  return (
    <Router
      location={''}
      navigator={{
        createHref: vi.fn(),
        push: vi.fn(),
        replace: vi.fn(),
        go: vi.fn(),
      }}
    >
      <NotificationContext.Provider value={mockNotificationContext}>
        <QueryClientProvider client={queryClient}>
          <Provider store={testStore}>
            <ThemeProvider theme={testTheme}>{children}</ThemeProvider>
          </Provider>
          ;
        </QueryClientProvider>
      </NotificationContext.Provider>
    </Router>
  );
};

/**
 * Render a form element via Formik for testing
 * @param ui - the form element to render
 * @param props - properties to inject into the element
 **/
export const renderForm = (
  ui: React.ReactNode,
  initialValues: any,
  props?: Partial<FormikConfig<any>>
) => {
  let injected: FormikProps<any>;
  const {rerender, ...rest} = render(
    <TestWrapper>
      <Formik onSubmit={() => {}} initialValues={initialValues} {...props}>
        {(formikProps: FormikProps<any>) =>
          (injected = formikProps) && ui ? ui : null
        }
      </Formik>
    </TestWrapper>
  );
  return {
    getFormProps(): FormikProps<any> {
      return injected;
    },
    ...rest,
    rerender: () =>
      rerender(
        <TestWrapper>
          <Formik onSubmit={() => {}} initialValues={initialValues} {...props}>
            {(formikProps: FormikProps<any>) =>
              (injected = formikProps) && ui ? ui : null
            }
          </Formik>
        </TestWrapper>
      ),
  };
};
/**
 * instantiateField - instantiate a field from a uiSpec for testing
 * @param uiSpec - uiSpec for the field we want to render
 * @returns - the rendered field element
 */
export const instantiateField = (uiSpec: any, initialValues: any) => {
  const formProps = {
    values: {},
    errors: {},
    touched: {},
    handleChange: () => {},
    setFieldValue: () => {},
    isSubmitting: false,
    isValidating: false,
    submitCount: 0,
  };
  // can't get all of the members of FormikProps, so just ignore the error
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const element = getComponentFromFieldConfig(uiSpec, 'test', formProps);
  return renderForm(element, initialValues);
};
