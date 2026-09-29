// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: 404.tsx
 * Description:
 *   TODO
 */

import {render, screen} from '@testing-library/react';
import {BrowserRouter as Router} from 'react-router-dom';
import NotFound404 from './404';
import {test, expect} from 'vitest';

test('Check 404 page', async () => {
  render(
    <Router>
      <NotFound404 />
    </Router>
  );
  expect(screen.getByText('404')).toBeTruthy();

  expect(screen.getByText('Home')).toBeTruthy();

  expect(screen.getByText('Go home')).toBeTruthy();
});
