// SPDX-License-Identifier: Apache-2.0
import {
  INPUT_LIMITS,
  PostFeedbackRequestSchema,
  PostFeedbackResponseSchema,
} from '../src';

const longString = (length: number) => 'a'.repeat(length);

describe('PostFeedbackRequestSchema', () => {
  it('accepts a trimmed non-empty message', () => {
    expect(
      PostFeedbackRequestSchema.parse({message: '  hello from the field  '})
    ).toEqual({message: 'hello from the field'});
  });

  it('accepts optional bounded diagnostics', () => {
    const parsed = PostFeedbackRequestSchema.parse({
      message: 'The save button did nothing.',
      source: 'app',
      category: 'bug',
      path: 'https://app.example/notebooks/abc',
      clientVersion: '1.10.0',
      userAgent: 'Mozilla/5.0',
    });
    expect(parsed.source).toBe('app');
    expect(parsed.category).toBe('bug');
  });

  it('rejects empty or whitespace-only messages', () => {
    expect(PostFeedbackRequestSchema.safeParse({message: ''}).success).toBe(
      false
    );
    expect(PostFeedbackRequestSchema.safeParse({message: '   '}).success).toBe(
      false
    );
  });

  it('rejects a message longer than LONG_TEXT_MAX_LENGTH', () => {
    const result = PostFeedbackRequestSchema.safeParse({
      message: longString(INPUT_LIMITS.LONG_TEXT_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid source discriminator', () => {
    const result = PostFeedbackRequestSchema.safeParse({
      message: 'hello',
      source: 'mobile',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown body fields so identity cannot be injected', () => {
    const result = PostFeedbackRequestSchema.safeParse({
      message: 'hello',
      user_id: 'attacker',
      email: 'spoof@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an over-long path diagnostic', () => {
    const result = PostFeedbackRequestSchema.safeParse({
      message: 'hello',
      path: longString(INPUT_LIMITS.REDIRECT_URL_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe('PostFeedbackResponseSchema', () => {
  it('accepts the success envelope', () => {
    expect(PostFeedbackResponseSchema.parse({success: true})).toEqual({
      success: true,
    });
  });

  it('rejects a failed envelope', () => {
    expect(PostFeedbackResponseSchema.safeParse({success: false}).success).toBe(
      false
    );
  });
});
