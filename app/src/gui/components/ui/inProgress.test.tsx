// SPDX-License-Identifier: Apache-2.0

/*
 * Filename: inProgress.test.tsx
 * Description:
 *   TODO
 */

import {render, screen} from '@testing-library/react';
import InProgress from './inProgress';
import {test, expect} from 'vitest';

test('Check inProgress element', () => {
  render(<InProgress />);

  expect(screen.getByText('Feature in progress')).toBeTruthy();
});
