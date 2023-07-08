import {render, screen} from '@testing-library/react';
import RecordRouteDisplay from './record_link';
import {BrowserRouter} from 'react-router-dom';

/* jest.mock() */

test('Check record link', () => {
  render(
    <BrowserRouter>
      <RecordRouteDisplay link="/test-route">
        <div>Test link</div>
      </RecordRouteDisplay>
    </BrowserRouter>
  );

  expect(screen.getByText('Test link')).toBeTruthy();
});
