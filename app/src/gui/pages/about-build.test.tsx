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
 * Filename: about-build.test.tsx
 * Description:
 *   Renders the about-build page and checks the configuration summary.
 */

import {fireEvent, render, screen, within} from '@testing-library/react';
import {BrowserRouter as Router} from 'react-router-dom';
import AboutBuild from './about-build';
import {progressiveSaveFiles} from '../../sync/data-dump';
import {config} from '../../buildconfig';
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
  expect(screen.getByRole('heading', {name: 'Configuration'})).toBeTruthy();

  const configuration = screen.getByTestId('build-configuration');
  expect(configuration.querySelector('pre')).toBeNull();
  expect(configuration.querySelector('table')).toBeNull();

  const configList = within(configuration);
  expect(configList.getByText('App name')).toBeTruthy();
  expect(configList.getByText(config.headingAppName)).toBeTruthy();
  expect(configList.getByText('App ID')).toBeTruthy();
  expect(configList.getByText(config.appId)).toBeTruthy();
  const serverLabel = config.conductorUrls.length > 1 ? 'Servers' : 'Server';
  expect(configList.getByText(serverLabel)).toBeTruthy();
  for (const url of config.conductorUrls) {
    expect(configList.getByText(url)).toBeTruthy();
  }
  expect(configList.getByText('Version')).toBeTruthy();
  expect(configList.getByText(config.appVersion)).toBeTruthy();
  expect(configList.getByText('Commit')).toBeTruthy();
  expect(
    configList.getByText(config.commitHash ?? 'Not provided.')
  ).toBeTruthy();
  expect(configList.queryByText('Records called')).toBeNull();
  expect(configList.queryByText('Maps')).toBeNull();
  expect(configList.queryByText('Offline maps')).toBeNull();

  expect(screen.getByText(config.supportEmail)).toBeTruthy();
  expect(screen.getByText(config.privacyPolicyUrl)).toBeTruthy();
  if (config.contactUrl) {
    expect(screen.getByText(config.contactUrl)).toBeTruthy();
  }
  if (config.runningUnderTest) {
    expect(screen.getByText('Running under test')).toBeTruthy();
  }

  expect(screen.getByText('Refresh the app')).toBeTruthy();

  expect(screen.getByText('Backup from this device')).toBeTruthy();

  if (config.showWipe) {
    expect(screen.getByText('Wipe and reset everything')).toBeTruthy();
  }

  if (config.showPouchdbBrowser) {
    expect(screen.getByText('Open Raw Database Interface')).toBeTruthy();
  }

  fireEvent.click(screen.getByText('Share local database contents'));

  expect(progressiveSaveFiles).toBeCalled();
});
