import {existsSync, readFileSync} from 'fs';
import {dirname, isAbsolute, join, resolve} from 'path';
import {
  COLLECTION_PROFILES_DIR_ENV_VAR,
  CollectionProfileSchema,
  isCollectionPhaseKind,
  parseCollectionProfile,
  type CollectionProfile,
} from './collection-profile.js';
import {
  SEQUENCE_PLAN_FILE_ENV_VAR,
  type SequenceNode,
  type SequencePlan,
} from './sequence-plan.js';

/** Bundled profiles shipped with @faims3/load-testing-shared. */
export function bundledCollectionProfilesDir(): string {
  return join(__dirname, '../../collection-profiles');
}

/** Resolve collection-profiles dir from env, plan file location, or bundled default. */
function resolveProfilesDirectory(
  env: Record<string, string | undefined>
): string {
  const configured = env[COLLECTION_PROFILES_DIR_ENV_VAR]?.trim();
  if (configured) {
    return isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);
  }

  const planFile = env[SEQUENCE_PLAN_FILE_ENV_VAR]?.trim();
  if (planFile) {
    return resolve(dirname(resolve(planFile)), '../collection-profiles');
  }

  return bundledCollectionProfilesDir();
}

/** Load a profile JSON by filename (relative to profilesDir) or absolute path. */
function loadProfileByName(
  name: string,
  profilesDir: string
): CollectionProfile {
  const trimmed = name.trim();
  const candidate = trimmed.includes('/')
    ? resolve(trimmed)
    : resolve(profilesDir, trimmed.endsWith('.json') ? trimmed : `${trimmed}.json`);

  if (!existsSync(candidate)) {
    throw new Error(
      `Collection profile not found: ${candidate} (dir=${profilesDir})`
    );
  }

  return parseCollectionProfile(readFileSync(candidate, 'utf8'));
}

/** Inline a filename ref or validate an already-embedded profile object. */
function resolvePhaseConfig(
  config: Record<string, unknown>,
  profilesDir: string
): void {
  const ref = config.collectionProfile;
  if (ref === undefined) {
    return;
  }

  if (typeof ref === 'string') {
    config.collectionProfile = loadProfileByName(ref, profilesDir);
    return;
  }

  config.collectionProfile = CollectionProfileSchema.parse(ref);
}

/** Walk the plan tree and resolve collection profile refs on phase steps. */
function walkNodes(nodes: SequenceNode[], profilesDir: string): void {
  for (const node of nodes) {
    if ('kind' in node && isCollectionPhaseKind(node.kind)) {
      resolvePhaseConfig(node.config as Record<string, unknown>, profilesDir);
      continue;
    }

    if ('loop' in node) {
      walkNodes(node.loop.steps, profilesDir);
      continue;
    }

    if ('split' in node) {
      for (const branch of node.split.branches) {
        walkNodes(branch.steps, profilesDir);
      }
    }
  }
}

/**
 * Resolve `config.collectionProfile` filename references to inline profile
 * objects so agents receive the full workflow over HTTP.
 */
export function resolveCollectionProfilesInPlan(
  plan: SequencePlan,
  env: Record<string, string | undefined> = process.env
): SequencePlan {
  const profilesDir = resolveProfilesDirectory(env);
  walkNodes(plan.steps, profilesDir);
  return plan;
}
