// SPDX-License-Identifier: Apache-2.0

import '@testing-library/jest-dom/vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {TestWrapper} from '../../testUtils';
import FeedbackDialog from './FeedbackDialog';
import {
  FEEDBACK_OFFLINE_MESSAGE,
  FEEDBACK_RATE_LIMIT_MESSAGE,
} from './submitFeedback';

const CONDUCTOR_URL = 'http://test-server.example';
const TOKEN = 'test-token';

function renderDialog(open = true) {
  const onClose = vi.fn();
  render(
    <TestWrapper>
      <FeedbackDialog
        open={open}
        onClose={onClose}
        conductorUrl={CONDUCTOR_URL}
        token={TOKEN}
      />
    </TestWrapper>
  );
  return {onClose};
}

describe('FeedbackDialog', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requires a message before submit', () => {
    renderDialog();
    expect(screen.getByTestId('app-feedback-submit')).toBeDisabled();
  });

  it('submits to POST /api/feedback with the bearer token and closes on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({success: true}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const {onClose} = renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByTestId('app-feedback-message'), 'Maps lag.');
    await user.click(screen.getByTestId('app-feedback-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${CONDUCTOR_URL}/api/feedback`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    const body = JSON.parse(init.body);
    expect(body.message).toBe('Maps lag.');
    expect(body.source).toBe('app');
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows a 429 error and leaves the message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByTestId('app-feedback-message'), 'Keep this.');
    await user.click(screen.getByTestId('app-feedback-submit'));

    expect(await screen.findByTestId('app-feedback-error')).toHaveTextContent(
      FEEDBACK_RATE_LIMIT_MESSAGE
    );
    expect(screen.getByTestId('app-feedback-message')).toHaveValue(
      'Keep this.'
    );
    expect(screen.getByText('Send feedback')).toBeTruthy();
  });

  it('shows a connection error when fetch fails and leaves the text', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);
    renderDialog();
    const user = userEvent.setup();

    await user.type(screen.getByTestId('app-feedback-message'), 'Still here.');
    await user.click(screen.getByTestId('app-feedback-submit'));

    expect(await screen.findByTestId('app-feedback-error')).toHaveTextContent(
      FEEDBACK_OFFLINE_MESSAGE
    );
    expect(screen.getByTestId('app-feedback-message')).toHaveValue(
      'Still here.'
    );
  });

  it('does not POST while navigator.onLine is false', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    renderDialog();

    fireEvent.change(screen.getByTestId('app-feedback-message'), {
      target: {value: 'Offline note'},
    });
    fireEvent.click(screen.getByTestId('app-feedback-submit'));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(await screen.findByTestId('app-feedback-error')).toHaveTextContent(
      FEEDBACK_OFFLINE_MESSAGE
    );
    expect(screen.getByTestId('app-feedback-message')).toHaveValue(
      'Offline note'
    );
  });
});
