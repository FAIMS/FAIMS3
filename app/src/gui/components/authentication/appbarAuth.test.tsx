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
 * Filename: appbarAuth.test.tsx
 */

import {TestWrapper} from '../../fields/utils';
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
