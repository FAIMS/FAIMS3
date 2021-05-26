import React from 'react';
import {render, screen} from '@testing-library/react';
import {act} from 'react-dom/test-utils';
import App from '../App';
//
//// No projects created or to be created during init.
//jest.mock('./sync/index', () => ({
//  initialize: () => Promise.resolve(),
//  add_initial_listener: (
//    registering_func: (initialEvents: unknown) => unknown
//  ) =>
//    registering_func({
//      // eslint-disable-next-line @typescript-eslint/no-unused-vars
//      on: (_event_name: string, ..._args: unknown[]) => {},
//    }),
//}));
//
//test('renders app', async () => {
//  act(() => {
//    render(<App />);
//  });
//  // I'm entirely unsure of how to wait for a bit till the state.initialized is set true
//  return await new Promise((resolve, reject) => {
//    setTimeout(() => {
//      try {
//        const linkElement = screen.getByText(/FAIMS/i);
//        expect(linkElement).toBeInTheDocument();
//      } catch (err) {
//        reject(err);
//      }
//      resolve(undefined);
//    }, 1000);
//  });
//});
