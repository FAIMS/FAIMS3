/**
 * Tests for the shared input limits: central constants, bounded zod helpers
 * and the .max() caps applied across the API request schemas.
 */
import {
  CreateNotebookFromScratchSchema,
  CreateNotebookFromTemplateSchema,
  estimateJsonBytes,
  INPUT_LIMITS,
  PostChangePasswordInputSchema,
  PostCreateGlobalInviteInputSchema,
  PostCreateResourceInviteInputSchema,
  PostCreateTeamInputSchema,
  PostCreateTemplateInputSchema,
  PostLoginInputSchema,
  PostRecordStatusInputSchema,
  PostRegisterInputSchema,
  PutRequestPasswordResetRequestSchema,
  PutUpdateNotebookMetadataInputSchema,
  PutUpdateTeamInputSchema,
  Role,
} from '../src';
import {NotebookUiSpecificationInputSchema} from '../src/uiSpecification';

const longString = (length: number) => 'a'.repeat(length);

describe('input limit constants', () => {
  it('exposes sensible values', () => {
    expect(INPUT_LIMITS.EMAIL_MAX_LENGTH).toBe(254);
    expect(INPUT_LIMITS.PASSWORD_MAX_LENGTH).toBeGreaterThanOrEqual(64);
    expect(INPUT_LIMITS.UI_SPEC_MAX_BYTES).toBeGreaterThan(1024 * 1024);
  });
});

describe('auth schemas', () => {
  it('rejects an oversized login email and password', () => {
    const result = PostLoginInputSchema.safeParse({
      action: 'login',
      email: longString(INPUT_LIMITS.EMAIL_MAX_LENGTH + 1),
      password: 'password123',
    });
    expect(result.success).toBe(false);

    const result2 = PostLoginInputSchema.safeParse({
      action: 'login',
      email: 'user@example.com',
      password: longString(INPUT_LIMITS.PASSWORD_MAX_LENGTH + 1),
    });
    expect(result2.success).toBe(false);
  });

  it('accepts a normal login', () => {
    const result = PostLoginInputSchema.safeParse({
      action: 'login',
      email: 'user@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects oversized registration name and password', () => {
    const base = {
      action: 'register',
      email: 'user@example.com',
      password: 'aStrongPassword123',
      repeat: 'aStrongPassword123',
      name: 'Normal Name',
    };
    expect(PostRegisterInputSchema.safeParse(base).success).toBe(true);
    expect(
      PostRegisterInputSchema.safeParse({
        ...base,
        name: longString(INPUT_LIMITS.PERSON_NAME_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
    expect(
      PostRegisterInputSchema.safeParse({
        ...base,
        password: longString(INPUT_LIMITS.PASSWORD_MAX_LENGTH + 1),
        repeat: longString(INPUT_LIMITS.PASSWORD_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
  });

  it('rejects oversized change-password fields', () => {
    const result = PostChangePasswordInputSchema.safeParse({
      username: 'user',
      currentPassword: longString(INPUT_LIMITS.PASSWORD_MAX_LENGTH + 1),
      newPassword: 'newPassword123',
      confirmPassword: 'newPassword123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an oversized reset code', () => {
    const result = PutRequestPasswordResetRequestSchema.safeParse({
      code: longString(INPUT_LIMITS.CODE_MAX_LENGTH + 1),
      newPassword: 'newPassword123',
    });
    expect(result.success).toBe(false);
  });
});

describe('notebook and template schemas', () => {
  it('rejects an oversized notebook name', () => {
    expect(
      CreateNotebookFromTemplateSchema.safeParse({
        name: longString(INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH + 1),
        template_id: 'template-1',
      }).success
    ).toBe(false);
    expect(
      CreateNotebookFromTemplateSchema.safeParse({
        name: 'My Survey',
        template_id: 'template-1',
      }).success
    ).toBe(true);
  });

  it('rejects an oversized metadata update name', () => {
    expect(
      PutUpdateNotebookMetadataInputSchema.safeParse({
        name: longString(INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
  });

  it('rejects an oversized template name', () => {
    expect(
      PostCreateTemplateInputSchema.safeParse({
        name: longString(INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH + 1),
        uiSpecification: {},
      }).success
    ).toBe(false);
  });

  it('rejects an oversized ui specification payload', () => {
    // Build an object slightly over the byte budget
    const bigValue = longString(INPUT_LIMITS.UI_SPEC_MAX_BYTES + 1024);
    expect(
      NotebookUiSpecificationInputSchema.safeParse({blob: bigValue}).success
    ).toBe(false);
    expect(
      NotebookUiSpecificationInputSchema.safeParse({small: 'ok'}).success
    ).toBe(true);
    expect(
      CreateNotebookFromScratchSchema.safeParse({
        name: 'Survey',
        uiSpecification: {blob: bigValue},
      }).success
    ).toBe(false);
  });

  it('bounds the record status map size', () => {
    const okMap: Record<string, string> = {};
    for (let i = 0; i < 10; i++) okMap[`rec-${i}`] = 'hash';
    expect(
      PostRecordStatusInputSchema.safeParse({record_map: okMap}).success
    ).toBe(true);

    const bigMap: Record<string, string> = {};
    for (let i = 0; i < INPUT_LIMITS.RECORD_MAP_MAX_ENTRIES + 1; i++) {
      bigMap[`rec-${i}`] = 'hash';
    }
    expect(
      PostRecordStatusInputSchema.safeParse({record_map: bigMap}).success
    ).toBe(false);
  });
});

describe('team schemas', () => {
  it('rejects oversized team name and description', () => {
    expect(
      PostCreateTeamInputSchema.safeParse({
        name: longString(INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH + 1),
        description: 'A team',
      }).success
    ).toBe(false);
    expect(
      PostCreateTeamInputSchema.safeParse({
        name: 'Valid team',
        description: longString(INPUT_LIMITS.TEAM_DESCRIPTION_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
    expect(
      PostCreateTeamInputSchema.safeParse({
        name: 'Valid team',
        description: 'A perfectly fine description',
      }).success
    ).toBe(true);
    expect(
      PutUpdateTeamInputSchema.safeParse({
        description: longString(INPUT_LIMITS.TEAM_DESCRIPTION_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
  });
});

describe('invite schemas', () => {
  it('rejects oversized invite name and uses', () => {
    expect(
      PostCreateResourceInviteInputSchema.safeParse({
        role: Role.PROJECT_CONTRIBUTOR,
        name: longString(INPUT_LIMITS.INVITE_NAME_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
    expect(
      PostCreateResourceInviteInputSchema.safeParse({
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Field crew invite',
        uses: INPUT_LIMITS.INVITE_MAX_USES + 1,
      }).success
    ).toBe(false);
    expect(
      PostCreateResourceInviteInputSchema.safeParse({
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Field crew invite',
        uses: 10,
      }).success
    ).toBe(true);
    expect(
      PostCreateGlobalInviteInputSchema.safeParse({
        role: Role.GENERAL_USER,
        name: longString(INPUT_LIMITS.INVITE_NAME_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
  });
});

describe('estimateJsonBytes', () => {
  it('estimates serialized size', () => {
    expect(estimateJsonBytes({a: 'bb'})).toBe(JSON.stringify({a: 'bb'}).length);
    expect(estimateJsonBytes(undefined)).toBe(0);
  });

  it('fails closed for non-serializable values', () => {
    const circular: {self?: unknown} = {};
    circular.self = circular;
    expect(estimateJsonBytes(circular)).toBeGreaterThan(
      INPUT_LIMITS.UI_SPEC_MAX_BYTES
    );
  });
});
