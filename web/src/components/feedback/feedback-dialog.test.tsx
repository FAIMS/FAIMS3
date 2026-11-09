// SPDX-License-Identifier: Apache-2.0
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {config} from '@/constants';
import {FeedbackButton, FeedbackDialog} from './feedback-dialog';
import {FEEDBACK_RATE_LIMIT_MESSAGE} from './submit-feedback';

describe('FeedbackButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders the header control and opens the dialog', async () => {
    const user = userEvent.setup();
    render(
      <FeedbackButton
        source="web"
        token="test-token"
        testId="web-feedback-button"
      />
    );
    const trigger = screen.getByTestId('web-feedback-button');
    expect(trigger.textContent).toContain('Feedback');
    await user.click(trigger);
    expect(await screen.findByTestId('web-feedback-dialog')).toBeTruthy();
    expect(screen.getByTestId('web-feedback-message')).toBeTruthy();
    expect(screen.getByTestId('web-feedback-submit')).toBeTruthy();
  });

  it('POSTs to config.apiUrl/api/feedback with the bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({success: true}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <FeedbackButton
        source="web"
        token="test-token"
        testId="web-feedback-button"
      />
    );
    await user.click(screen.getByTestId('web-feedback-button'));
    await user.type(
      screen.getByTestId('web-feedback-message'),
      'Please add bulk export.'
    );
    await user.click(screen.getByTestId('web-feedback-submit'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${config.apiUrl}/api/feedback`);
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer test-token');
    const body = JSON.parse(init.body as string);
    expect(body.message).toBe('Please add bulk export.');
    expect(body.source).toBe('web');
    await waitFor(() =>
      expect(screen.queryByTestId('web-feedback-dialog')).toBeNull()
    );
  });

  it('shows a 429 error and leaves the message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <FeedbackButton
        source="web"
        token="test-token"
        testId="web-feedback-button"
      />
    );
    await user.click(screen.getByTestId('web-feedback-button'));
    await user.type(screen.getByTestId('web-feedback-message'), 'Keep me.');
    await user.click(screen.getByTestId('web-feedback-submit'));

    expect(await screen.findByTestId('web-feedback-error')).toBeTruthy();
    expect(screen.getByTestId('web-feedback-error').textContent).toContain(
      FEEDBACK_RATE_LIMIT_MESSAGE
    );
    expect(
      (screen.getByTestId('web-feedback-message') as HTMLTextAreaElement).value
    ).toBe('Keep me.');
  });
});

describe('FeedbackDialog designer source', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sends source designer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({success: true}),
    });
    vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup();
    render(
      <FeedbackDialog
        open={true}
        onOpenChange={() => {}}
        source="designer"
        token="designer-token"
      />
    );
    await user.type(
      screen.getByTestId('web-feedback-message'),
      'The field list jumps.'
    );
    await user.click(screen.getByTestId('web-feedback-submit'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.source).toBe('designer');
  });
});
