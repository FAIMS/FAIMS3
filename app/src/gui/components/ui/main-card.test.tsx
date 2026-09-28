// SPDX-License-Identifier: Apache-2.0

/*
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
