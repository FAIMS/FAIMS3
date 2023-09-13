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

import {render, screen} from '@testing-library/react';
import AppBarAuth from './appbarAuth';
import {BrowserRouter} from 'react-router-dom';
import {describe, expect, it} from 'vitest';

const testToken = {
  username: 'admin',
  roles: ['cluster-admin'],
  name: 'Admin User',
};

describe('Check appbarAuth', () => {
  it('Check without token', () => {
    render(
      <BrowserRouter>
        <AppBarAuth />
      </BrowserRouter>
    );
    expect(screen.getByText('Sign In')).toBeTruthy();
  });

  it('Check with token', () => {
    render(
      <BrowserRouter>
        <AppBarAuth token={testToken} />
      </BrowserRouter>
    );
    expect(screen.getByText(testToken.username)).toBeTruthy();

    expect(screen.getByText('Workspace')).toBeTruthy();

    expect(screen.getByText('Switch User')).toBeTruthy();

    expect(screen.getByText(`Log out ${testToken.username}`)).toBeTruthy();
  });
});
