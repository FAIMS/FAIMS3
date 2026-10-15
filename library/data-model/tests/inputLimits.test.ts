// SPDX-License-Identifier: Apache-2.0
/**
 * Tests for the shared input limits: central constants, bounded zod helpers
 * and the .max() caps applied across the API request schemas.
 */
import {
  AuthContextSchema,
  CreateNotebookFromScratchSchema,
  CreateNotebookFromTemplateSchema,
  estimateJsonBytes,
  INPUT_LIMITS,
  MAP_ASSET_UPLOAD_BUSY_MESSAGE,
  MAP_ASSET_UPLOAD_FREE_DISK_BYTES,
  mapAssetUploadMaxLabel,
  mapAssetUploadTooLargeMessage,
  ROOT_DESCRIPTION_MAX_LENGTH,
  PostChangePasswordInputSchema,
  PostCreateGlobalInviteInputSchema,
  PostCreateResourceInviteInputSchema,
  MapAssetDetailsSchema,
  MapAssetStatusSchema,
  MapAssetProcessingStageSchema,
  ExistingMapAssetSchema,
  GetMapAssetDownloadUrlResponseSchema,
  isMapAssetInProgress,
  mapAssetProcessingStageLabel,
  PostCreateTeamInputSchema,
  PostCreateTemplateInputSchema,
  PostMapAssetLinkInputSchema,
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
    expect(INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_BYTES).toBe(
      2 * 1024 * 1024 * 1024
    );
    expect(INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_FILES).toBe(8);
    expect(mapAssetUploadMaxLabel()).toBe('2 GB');
    expect(mapAssetUploadTooLargeMessage()).toBe('Files must be at most 2 GB.');
    expect(MAP_ASSET_UPLOAD_FREE_DISK_BYTES).toBe(
      3 * INPUT_LIMITS.MAP_ASSET_UPLOAD_MAX_BYTES
    );
    expect(MAP_ASSET_UPLOAD_BUSY_MESSAGE).toMatch(/server is busy/i);
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

  it('rejects an oversized inviteId on auth context', () => {
    expect(
      AuthContextSchema.safeParse({
        action: 'register',
        inviteId: longString(INPUT_LIMITS.ID_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
    expect(
      AuthContextSchema.safeParse({
        action: 'register',
        inviteId: 'FAIMS-abcdefghijklmnop',
      }).success
    ).toBe(true);
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

  it('accepts a disableQuickShare metadata update', () => {
    expect(
      PutUpdateNotebookMetadataInputSchema.safeParse({
        disableQuickShare: true,
      }).success
    ).toBe(true);
    expect(
      PutUpdateNotebookMetadataInputSchema.safeParse({
        disableQuickShare: false,
      }).success
    ).toBe(true);
    expect(PutUpdateNotebookMetadataInputSchema.safeParse({}).success).toBe(
      true
    );
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

describe('map layer schemas', () => {
  it('rejects oversized layer name and description', () => {
    expect(
      MapAssetDetailsSchema.safeParse({
        name: longString(INPUT_LIMITS.RESOURCE_NAME_MAX_LENGTH + 1),
        description: '',
      }).success
    ).toBe(false);
    expect(
      MapAssetDetailsSchema.safeParse({
        name: 'Site boundary',
        description: longString(ROOT_DESCRIPTION_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
    expect(
      MapAssetDetailsSchema.safeParse({
        name: 'Site boundary',
        description: 'Optional layer notes',
      }).success
    ).toBe(true);
  });

  it('accepts pending and processing statuses as in-progress', () => {
    expect(MapAssetStatusSchema.safeParse('pending').success).toBe(true);
    expect(MapAssetStatusSchema.safeParse('processing').success).toBe(true);
    expect(isMapAssetInProgress('pending')).toBe(true);
    expect(isMapAssetInProgress('processing')).toBe(true);
    expect(isMapAssetInProgress('ready')).toBe(false);
    expect(isMapAssetInProgress('failed')).toBe(false);
  });

  it('maps processing stages to user-facing messages', () => {
    expect(MapAssetProcessingStageSchema.safeParse('downloading').success).toBe(
      true
    );
    expect(mapAssetProcessingStageLabel('downloading')).toBe(
      'Downloading data'
    );
    expect(mapAssetProcessingStageLabel('interpreting-crs')).toBe(
      'Interpreting CRS'
    );
    expect(mapAssetProcessingStageLabel('converting-geometries')).toBe(
      'Converting geometries'
    );
    expect(mapAssetProcessingStageLabel(undefined)).toBeUndefined();
  });

  it('accepts storedAttachments object-store metadata on an existing asset', () => {
    expect(
      ExistingMapAssetSchema.safeParse({
        _id: 'asset-1',
        _rev: '1-abc',
        docType: 'asset',
        name: 'Site boundary',
        description: '',
        createdBy: 'user-1',
        originalFilename: 'layer.geojson',
        byteSize: 12,
        status: 'ready',
        kind: 'vector-tiles',
        defaultStyle: {
          stroke: '#1565c0',
          fill: '#1565c040',
          lineWidth: 2,
          pointSize: 6,
          opacity: 0.85,
        },
        createdAt: 1,
        updatedAt: 1,
        storedAttachments: {
          original: {
            provider: 's3',
            resourceUri:
              's3://us-east-1/faims-map-assets/map-assets/asset-1/original',
            contentType: 'application/octet-stream',
            byteSize: 2,
            endpoint: 'http://localhost:9000',
          },
          normalized: {
            provider: 's3',
            resourceUri:
              's3://us-east-1/faims-map-assets/map-assets/asset-1/normalized',
            contentType: 'application/vnd.pmtiles',
            byteSize: 12,
          },
        },
      }).success
    ).toBe(true);
  });

  it('accepts a map-layer download-url grant', () => {
    expect(
      GetMapAssetDownloadUrlResponseSchema.safeParse({
        url: 'https://s3.example/object?X-Amz-Signature=abc',
        mediaType: 'application/vnd.pmtiles',
        filename: 'Site boundary.pmtiles',
        byteSize: 12,
        expiresInSeconds: 3600,
      }).success
    ).toBe(true);
  });

  it('rejects an oversized link project id', () => {
    expect(
      PostMapAssetLinkInputSchema.safeParse({
        projectId: longString(INPUT_LIMITS.ID_MAX_LENGTH + 1),
      }).success
    ).toBe(false);
    expect(
      PostMapAssetLinkInputSchema.safeParse({
        projectId: 'notebook-1',
      }).success
    ).toBe(true);
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

  it('rejects invite expiry beyond 90 days and accepts a 5-day expiry', () => {
    const now = Date.now();
    expect(
      PostCreateResourceInviteInputSchema.safeParse({
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Field crew invite',
        expiry: now + 91 * 24 * 60 * 60 * 1000,
      }).success
    ).toBe(false);
    expect(
      PostCreateResourceInviteInputSchema.safeParse({
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Field crew invite',
        expiry: now - 1000,
      }).success
    ).toBe(false);
    expect(
      PostCreateResourceInviteInputSchema.safeParse({
        role: Role.PROJECT_CONTRIBUTOR,
        name: 'Field crew invite',
        expiry: now + 5 * 24 * 60 * 60 * 1000,
      }).success
    ).toBe(true);
    expect(
      PostCreateGlobalInviteInputSchema.safeParse({
        role: Role.GENERAL_USER,
        name: 'Global invite',
        expiry: now + 91 * 24 * 60 * 60 * 1000,
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
