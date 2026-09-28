// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: appbarAuth.test.tsx
 */

import {TestWrapper} from '../../testUtils';
import {render, screen} from '@testing-library/react';
import AppBarAuth from './appbarAuth';
import {describe, expect, it} from 'vitest';

describe('Check appbarAuth', () => {
  // TODO: work out how to run a test without token, need to
  // change global state when we render
  // it('Check without token', () => {
  //   render(
  //     <TestWrapper>
  //       <AppBarAuth />
  //     </TestWrapper>
  //   );
  //   expect(screen.getByText('Sign In')).toBeTruthy();
  // });

  it('Check with token', () => {
    render(
      <TestWrapper>
        <AppBarAuth />
      </TestWrapper>
    );
    // look for first initial of our Test User
    expect(screen.getByText('T')).toBeTruthy();
  });
});
