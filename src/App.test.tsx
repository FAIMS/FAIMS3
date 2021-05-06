import React from 'react';
import {render, screen} from '@testing-library/react';
import App from './App';

// No projects created or to be created during init.
jest.mock('./sync/index', () => ({
  initialize: () => Promise.resolve(),
  initializeEvents: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    on(event: string, listener: (...args: unknown[]) => unknown) {},
  },
  createdProjects: {},
}));

test('renders form', async () => {
  render(<App />);
  //const linkElement = screen.getByText(/is the current project/i);
  //expect(linkElement).toBeInTheDocument();
});
