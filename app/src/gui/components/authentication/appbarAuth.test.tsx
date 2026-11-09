// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: appbarAuth.test.tsx
 */

import '@testing-library/jest-dom/vitest';
import {TestWrapper} from '../../testUtils';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  selectActiveUser,
  selectIsAuthenticated,
} from '../../../context/slices/authSlice';
import {useAppSelector} from '../../../context/store';
import AppBarAuth from './appbarAuth';

describe('Check appbarAuth', () => {
  const originalUseAppSelector = vi
    .mocked(useAppSelector)
    .getMockImplementation();

  afterEach(() => {
    if (originalUseAppSelector) {
      vi.mocked(useAppSelector).mockImplementation(originalUseAppSelector);
    }
  });

  it('hides Send feedback when signed out and keeps the Sign In button', () => {
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
    render(
      <TestWrapper>
        <AppBarAuth />
      </TestWrapper>
    );
    expect(screen.getByText('Sign In')).toBeTruthy();
    expect(screen.queryByTestId('app-feedback-button')).toBeNull();
  });

  it('Check with token', async () => {
    render(
      <TestWrapper>
        <AppBarAuth />
      </TestWrapper>
    );
    // look for first initial of the user's name (not their email/username)
    expect(screen.getByText('A')).toBeTruthy();

    await userEvent.click(screen.getByTestId('app-nav-user-menu'));
    expect(screen.getByTestId('app-feedback-button')).toBeTruthy();
    expect(screen.getByText('Send feedback')).toBeTruthy();
  });
});
