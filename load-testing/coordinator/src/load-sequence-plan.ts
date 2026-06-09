import {readFileSync} from 'fs';
import {resolve} from 'path';
import {GetObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {
  parseSequencePlan,
  parseSequencePlanFromEnv,
  parseS3Uri,
  SEQUENCE_PLAN_B64_ENV_VAR,
  SEQUENCE_PLAN_ENV_VAR,
  SEQUENCE_PLAN_FILE_ENV_VAR,
  SEQUENCE_PLAN_S3_URI_ENV_VAR,
  resolveCollectionProfilesInPlan,
  sequencePlanSourceHint,
  type SequencePlan,
} from '@faims3/load-testing-shared';

/** Download and parse a sequence plan JSON object from S3. */
async function loadSequencePlanFromS3(uri: string): Promise<SequencePlan> {
  const {bucket, key} = parseS3Uri(uri);
  const client = new S3Client({});
  const response = await client.send(
    new GetObjectCommand({Bucket: bucket, Key: key})
  );
  const json = await response.Body?.transformToString('utf8');
  if (!json?.trim()) {
    throw new Error(`Empty or missing sequence plan object: ${uri}`);
  }
  return parseSequencePlan(json);
}

/**
 * Load and validate a sequence plan from the first configured source.
 *
 * Precedence: S3 URI → inline JSON / base64 → local file path.
 */
export async function loadSequencePlan(
  env: Record<string, string | undefined> = process.env
): Promise<SequencePlan> {
  let plan: SequencePlan;

  const s3Uri = env[SEQUENCE_PLAN_S3_URI_ENV_VAR]?.trim();
  if (s3Uri) {
    plan = await loadSequencePlanFromS3(s3Uri);
  } else if (
    env[SEQUENCE_PLAN_ENV_VAR]?.trim() ||
    env[SEQUENCE_PLAN_B64_ENV_VAR]?.trim()
  ) {
    plan = parseSequencePlanFromEnv(env);
  } else {
    const file = env[SEQUENCE_PLAN_FILE_ENV_VAR]?.trim();
    if (file) {
      const json = readFileSync(resolve(file), 'utf8');
      plan = parseSequencePlan(json);
    } else {
      throw new Error(
        `Missing sequence plan: set one of ${sequencePlanSourceHint()}`
      );
    }
  }

  return resolveCollectionProfilesInPlan(plan, env);
}
