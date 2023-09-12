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
 * Filename: notebook.test.tsx
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
import Notebook from './notebook';
import {expect, vi, afterEach, it, describe} from 'vitest';

import {useNavigate} from 'react-router-dom';

afterEach(() => {
  cleanup();
});

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

export function mockGetProjectInfo(project_id: string) {
  return project_id ? testProjectInfo : undefined;
}

vi.mock('react-router-dom', () => {
  return {
    useParams: () => ({
      project_id: testProjectInfo.project_id,
    }),
    useNavigate: vi.fn(() => {}),
    Link: vi.fn(() => {}), // this prevents the project name appearing
    RouterLink: vi.fn(() => {}),
  };
});

vi.mock('../../databaseAccess', () => ({
  getProjectInfo: mockGetProjectInfo,
}));

describe('Check notebook page', () => {
  it('Check with project id', async () => {
    act(() => {
      render(<Notebook />);
    });

    expect(screen.getByTestId('progressbar')).toBeTruthy();

    await waitForElementToBeRemoved(() => screen.getByTestId('progressbar'));

    expect(screen.getAllByText(testProjectInfo.name)).toBeTruthy();

    expect(useNavigate).toBeCalledTimes(1);
  });
});
