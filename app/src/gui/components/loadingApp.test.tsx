// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: loadingApp.test.tsx
 * Description:
 *   TODO
 */

import {render, screen} from '@testing-library/react';
import LoadingApp from './loadingApp';
import {test, expect, vi} from 'vitest';

// Mock the SystemAlert component since it uses Redux
vi.mock('./alert', () => ({
  default: () => null,
}));

test('Check loadingApp component', () => {
  render(<LoadingApp />);

  expect(screen.getByText('Loading data')).toBeTruthy();

  expect(
    screen.getByText(
      'This may take some time on first load, depending on your connection speed.'
    )
  ).toBeTruthy();
});
