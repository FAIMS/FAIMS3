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
 * Filename: index.tsx
 * Description:
 *   TODO
 */

import {render, screen} from '@testing-library/react';
import {BrowserRouter as Router} from 'react-router-dom';
import Index from '.';
import {TokenContents} from 'faims3-datamodel';
import {expect, describe, vi, it} from 'vitest';

export function mockCheckToken(token: null | undefined | TokenContents) {
  return token ? true : false;
}

vi.mock('../../utils/helpers', () => ({
  checkToken: mockCheckToken,
}));

const testToken = {
  name: 'testData',
  roles: ['testData'],
  username: 'testData',
};

describe('Check index page', () => {
  it('Check without token', async () => {
    render(
      <Router>
        <Index />
      </Router>
    );
    expect(screen.getByText('Welcome')).toBeTruthy();

    expect(
      screen.getByText('Contact info@fieldmark.au for support.')
    ).toBeTruthy();

    expect(screen.getByText('Sign In')).toBeTruthy();
  });
  it('Check with token', async () => {
    render(
      <Router>
        <Index token={testToken} />
      </Router>
    );
    expect(screen.getByText('Welcome')).toBeTruthy();

    expect(
      screen.getByText('Contact info@fieldmark.au for support.')
    ).toBeTruthy();

    expect(screen.getByText('Workspace')).toBeTruthy();
  });
});
