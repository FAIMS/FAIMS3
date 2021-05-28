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
 * Filename: App.test.tsx
 * Description:
 *   TODO
 */

import React from 'react';
import {render, screen} from '@testing-library/react';
import {act} from 'react-dom/test-utils';
import App from '../App';

test('temp test as file cannot be empty', () => {
  expect(true).toBe(true);
});

//// No projects created or to be created during init.
//jest.mock('./sync/index', () => ({
//  initialize: () => Promise.resolve(),
//  add_initial_listener: (
//    registering_func: (initialEvents: unknown) => unknown
//  ) =>
//    registering_func({
//      // eslint-disable-next-line @typescript-eslint/no-unused-vars
//      on: (_event_name: string, ..._args: unknown[]) => {},
//    }),
//}));
//
//test('renders app', async () => {
//  act(() => {
//    render(<App />);
//  });
//  // I'm entirely unsure of how to wait for a bit till the state.initialized is set true
//  return await new Promise((resolve, reject) => {
//    setTimeout(() => {
//      try {
//        const linkElement = screen.getByText(/FAIMS/i);
//        expect(linkElement).toBeInTheDocument();
//      } catch (err) {
//        reject(err);
//      }
//      resolve(undefined);
//    }, 1000);
//  });
//});
