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
 * Filename: breadcrumbs.test.tsx
 *  * Description:
 *   TODO
 */

import {render, screen} from '@testing-library/react';
import {BrowserRouter as Router} from 'react-router-dom';
import Breadcrumbs from './breadcrumbs';
import {describe, it, expect} from 'vitest';

const testData1 = [{title: 'Workspace'}];
const testData2 = [{title: 'Workspace'}, {title: 'Notebook'}];

describe('Check breadcrumbs component', () => {
  it('Check with one element in array', async () => {
    render(
      <Router>
        <Breadcrumbs data={testData1} />
      </Router>
    );
    expect(screen.getByText(testData1[0].title)).toBeTruthy();
  });
  it('Check with two elements in array', async () => {
    render(
      <Router>
        <Breadcrumbs data={testData2} />
      </Router>
    );
    expect(screen.getByText(testData2[0].title)).toBeTruthy();

    expect(screen.getByText(testData2[1].title)).toBeTruthy();
  });
});
