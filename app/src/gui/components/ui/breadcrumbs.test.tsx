// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: breadcrumbs.test.tsx
 *  * Description:
 *   TODO
 */

import {render, screen} from '@testing-library/react';
import {BrowserRouter as Router} from 'react-router-dom';
import Breadcrumbs from './breadcrumbs';
import {describe, it, expect} from 'vitest';
import {config} from '../../../buildconfig';

const testData1 = [{title: 'Workspace'}];
const testData2 = [
  {title: 'Workspace'},
  {title: config.notebookNameCapitalized},
];

// Can only check this if breadcrumbs are enabled
describe('Check breadcrumbs component', () => {
  it('Check with one element in array', async () => {
    if (config.navigationStyle === 'breadcrumbs') {
      render(
        <Router>
          <Breadcrumbs data={testData1} />
        </Router>
      );
      expect(screen.getByText(testData1[0].title)).toBeTruthy();
    }
  });
  it('Check with two elements in array', async () => {
    if (config.navigationStyle === 'breadcrumbs') {
      render(
        <Router>
          <Breadcrumbs data={testData2} />
        </Router>
      );
      expect(screen.getByText(testData2[0].title)).toBeTruthy();

      expect(screen.getByText(testData2[1].title)).toBeTruthy();
    }
  });
});
