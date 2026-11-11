// SPDX-License-Identifier: Apache-2.0

import '@testing-library/jest-dom/vitest';
import {TestWrapper} from '../testUtils';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  selectActiveUser,
  selectIsAuthenticated,
} from '../../context/slices/authSlice';
import {useAppSelector} from '../../context/store';
import MainAppBar from './appBar';

vi.mock('../components/alert', () => ({default: () => null}));
vi.mock('../../sync/sync-state', () => ({default: () => null}));

describe('MainAppBar feedback trigger', () => {
  const originalUseAppSelector = vi
    .mocked(useAppSelector)
    .getMockImplementation();

  afterEach(() => {
    if (originalUseAppSelector) {
      vi.mocked(useAppSelector).mockImplementation(originalUseAppSelector);
    }
  });

  it('opens the feedback dialog from the hamburger menu', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <MainAppBar />
      </TestWrapper>
    );

    await user.click(screen.getByLabelText('open drawer'));
    const drawerFeedback = screen.getByTestId('app-nav-feedback');
    expect(drawerFeedback).toHaveTextContent('Send feedback');
    const aboutBuild = screen.getByText('About Build');
    expect(
      drawerFeedback.compareDocumentPosition(aboutBuild) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    await user.click(drawerFeedback);

    expect(screen.getByTestId('app-feedback-message')).toBeTruthy();
    expect(screen.getByTestId('app-feedback-submit')).toBeTruthy();
  });

  it('opens the same feedback dialog from the profile menu', async () => {
    const user = userEvent.setup();
    render(
      <TestWrapper>
        <MainAppBar />
      </TestWrapper>
    );

    await user.click(screen.getByTestId('app-nav-user-menu'));
    await user.click(screen.getByTestId('app-feedback-button'));

    expect(screen.getByTestId('app-feedback-message')).toBeTruthy();
    expect(screen.getByTestId('app-feedback-submit')).toBeTruthy();
  });

  it('hides the hamburger feedback item when signed out', async () => {
    vi.mocked(useAppSelector).mockImplementation(
      (fn: (state: unknown) => unknown) => {
        if (fn === selectActiveUser) {
          return undefined;
        }
        if (fn === selectIsAuthenticated) {
          return false;
        }
        return fn({
          auth: {activeUser: undefined, servers: {}, isAuthenticated: false},
          projects: {servers: {}},
        });
      }
    );

    const user = userEvent.setup();
    render(
      <TestWrapper>
        <MainAppBar />
      </TestWrapper>
    );

    await user.click(screen.getByLabelText('open drawer'));
    expect(screen.queryByTestId('app-nav-feedback')).toBeNull();
  });
});
