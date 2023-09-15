import {render, screen} from '@testing-library/react';
import RecordRouteDisplay from './record_link';
import {BrowserRouter} from 'react-router-dom';
import {test, expect} from 'vitest';

/* vi.mock() */

test('Check record link', () => {
  render(
    <BrowserRouter>
      <RecordRouteDisplay link="/test-route">Test link</RecordRouteDisplay>
    </BrowserRouter>
  );

  expect(screen.getByText('Test link')).toBeTruthy();
});
