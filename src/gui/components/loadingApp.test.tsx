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
 * Filename: loadingApp.test.tsx
 * Description:
 *   TODO
 */

import {render, screen} from '@testing-library/react';
import LoadingApp from './loadingApp';
import {test, expect} from 'vitest';

test('Check loadingApp component', () => {
  render(<LoadingApp />);

  expect(screen.getByText('Loading data')).toBeTruthy();

  expect(
    screen.getByText(
      'This may take some time on first load, depending on your connection speed.'
    )
  ).toBeTruthy();
});
