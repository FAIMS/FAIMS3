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
 * Filename: main-card.test.tsx
 * Description:
 *   Based on the free mantis dashboard template MainCard component: https://github.com/codedthemes/mantis-free-react-admin-template
 */

import {render, screen} from '@testing-library/react';
import MainCard from './main-card';
import {test, expect} from 'vitest';

test('Check main card', () => {
  render(
    <MainCard title="test-title">
      <div>Test div</div>
    </MainCard>
  );

  expect(screen.getByText('test-title')).toBeTruthy();

  expect(screen.getByText('Test div')).toBeTruthy();
});
