// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: notebook.test.tsx
 * Description:
 *   TODO
 */

import {TestWrapper} from '../testUtils';
import {act, cleanup, render, screen} from '@testing-library/react';
import Notebook from './notebook';
import {expect, vi, afterEach, it, describe} from 'vitest';

afterEach(() => {
  cleanup();
});

const testProjectInfo = {
  created: 'Unknown',
  description: 'No description',
  isActivated: true,
  last_updated: 'Unknown',
  listing_id: 'default',
  name: 'Test Name',
  project_id: 'test-project',
  status: 'published',
  metadata: {name: 'Test Name'},
};

vi.mock('react-router-dom', async () => {
  const actual = (await vi.importActual('react-router-dom')) satisfies Object;
  return {
    ...actual,
    useParams: () => ({
      projectId: testProjectInfo.project_id,
      serverId: 'test-server',
    }),
    useNavigate: vi.fn(() => vi.fn()),
    Link: vi.fn(() => {}),
    RouterLink: vi.fn(() => {}),
    NavLink: vi.fn(() => {}),
  };
});

describe('Check notebook page', () => {
  it('Check with project id', async () => {
    act(() => {
      render(
        <TestWrapper>
          <Notebook />
        </TestWrapper>
      );
    });

    // expect(screen.getByTestId('progressbar')).toBeTruthy();

    // await waitForElementToBeRemoved(() => screen.getByTestId('progressbar'));

    expect(screen.getAllByText(testProjectInfo.name)).toBeTruthy();

    //expect(useNavigate).toBeCalledTimes(1);
  });
});
