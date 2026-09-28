// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: about-build.tsx
 * Description:
 *   TODO
 */

import {fireEvent, render, screen} from '@testing-library/react';
import {BrowserRouter as Router} from 'react-router-dom';
import AboutBuild from './about-build';
import {progressiveSaveFiles} from '../../sync/data-dump';
import {expect, test, vi} from 'vitest';

vi.mock('../../sync/data-dump', () => ({
  progressiveSaveFiles: vi.fn(() => {}),
  doDumpDownload: vi.fn(() => {}),
}));

test('Check about-build component', async () => {
  render(
    <Router>
      <AboutBuild />
    </Router>
  );
  expect(screen.getByText('Server:')).toBeTruthy();

  expect(screen.getByText('Refresh the app')).toBeTruthy();

  expect(screen.getByText('Backup from this device')).toBeTruthy();

  expect(screen.getByText('Wipe and reset everything')).toBeTruthy();

  expect(screen.getByText('Open Raw Database Interface')).toBeTruthy();

  fireEvent.click(screen.getByText('Share local database contents'));

  expect(progressiveSaveFiles).toBeCalled();
});
