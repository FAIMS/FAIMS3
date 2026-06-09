import {z} from 'zod';
import {CollectionProfileRefSchema} from './collection-profile';

/**
 * FAIMS load-test sequence plan (v1).
 *
 * A sequence plan is a tree of steps executed by the coordinator and agents.
 * Steps can be nested with `loop`, or run in parallel subsets of agents with
 * `split`. Leaf steps are typed `phase` nodes with a `kind` and optional
 * `config`.
 *
 * ## Plan sources (coordinator only)
 *
 * The coordinator loads exactly one plan at startup. Agents receive steps via
 * HTTP (`GET /step`) and do not read plan JSON.
 *
 * | Variable | Use case |
 * |----------|----------|
 * | `SEQUENCE_PLAN_S3_URI` | AWS ECS runs (`s3://bucket/plans/name.json`) |
 * | `SEQUENCE_PLAN_FILE` | Local dev — path to `.json` on disk |
 * | `SEQUENCE_PLAN` | Inline compact JSON (small plans / tests) |
 * | `SEQUENCE_PLAN_B64` | Base64-encoded JSON (legacy ECS override) |
 *
 * Precedence: S3 URI → inline/base64 → file path.
 *
 * ## Splits
 *
 * A `split` step assigns each agent to exactly one branch using `assignment`:
 *
 * - `agent_index_mod` — stable by registration order (agent 0 → branch 0, …)
 * - `hash_agent_id` — stable hash of `agentId`
 * - `random` — coordinator picks at register time (reproducible per run via seed)
 *
 * Branch `weight` controls proportion (e.g. two branches weight 1 → ~50/50).
 *
 * ## Advance modes
 *
 * - `timer` — coordinator advances after `durationMs`
 * - `all_agents_done` — every agent must report step complete
 * - `majority_done` — >50% of agents
 * - `timer_or_all_done` — whichever happens first
 */

export const SEQUENCE_PLAN_ENV_VAR = 'SEQUENCE_PLAN';
export const SEQUENCE_PLAN_B64_ENV_VAR = 'SEQUENCE_PLAN_B64';
export const SEQUENCE_PLAN_S3_URI_ENV_VAR = 'SEQUENCE_PLAN_S3_URI';
export const SEQUENCE_PLAN_FILE_ENV_VAR = 'SEQUENCE_PLAN_FILE';

/** Parse `s3://bucket/object/key` into bucket and key. */
export function parseS3Uri(uri: string): {bucket: string; key: string} {
  const trimmed = uri.trim();
  if (!trimmed.startsWith('s3://')) {
    throw new Error(`Invalid S3 URI (expected s3://bucket/key): ${uri}`);
  }
  const withoutScheme = trimmed.slice('s3://'.length);
  const slash = withoutScheme.indexOf('/');
  if (slash < 1 || slash === withoutScheme.length - 1) {
    throw new Error(`Invalid S3 URI (expected s3://bucket/key): ${uri}`);
  }
  return {
    bucket: withoutScheme.slice(0, slash),
    key: withoutScheme.slice(slash + 1),
  };
}

/** Whether any supported sequence plan source is configured. */
export function hasSequencePlanSource(
  env: Record<string, string | undefined> = process.env
): boolean {
  return !!(
    env[SEQUENCE_PLAN_S3_URI_ENV_VAR]?.trim() ||
    env[SEQUENCE_PLAN_ENV_VAR]?.trim() ||
    env[SEQUENCE_PLAN_B64_ENV_VAR]?.trim() ||
    env[SEQUENCE_PLAN_FILE_ENV_VAR]?.trim()
  );
}

/** Human-readable hint for missing-plan errors. */
export function sequencePlanSourceHint(): string {
  return [
    SEQUENCE_PLAN_S3_URI_ENV_VAR,
    SEQUENCE_PLAN_ENV_VAR,
    SEQUENCE_PLAN_B64_ENV_VAR,
    SEQUENCE_PLAN_FILE_ENV_VAR,
  ].join(', ');
}

export const SequencePlanVersionSchema = z.literal(1);

/** How a step advances to the next plan node. */
export const StepAdvanceModeSchema = z.enum([
  'timer',
  'all_agents_done',
  'majority_done',
  'timer_or_all_done',
]);

/** How agents are assigned to split branches. */
export const SplitAssignmentSchema = z.enum([
  'agent_index_mod',
  'hash_agent_id',
  'random',
]);

const StepIdSchema = z
  .string()
  .min(1)
  .regex(
    /^[a-zA-Z][a-zA-Z0-9_-]*$/,
    'step id must start with a letter and contain only letters, digits, _ or -'
  );

const StepBaseSchema = z.object({
  /** Stable id used in metrics labels and agent logs. */
  id: StepIdSchema,
  /** Human-readable label for dashboards/logs. */
  label: z.string().optional(),
  /**
   * Step duration for timer-based advance modes.
   * Required when `advance` is `timer` or `timer_or_all_done`.
   */
  durationMs: z.number().int().positive().optional(),
  advance: StepAdvanceModeSchema.default('timer'),
});

export const OnboardingPhaseConfigSchema = z
  .object({
    /** Reserved for future onboarding knobs. */
  })
  .default({});

const CollectionPhaseConfigFields = {
  /** Filename in collection-profiles/ or inline profile (resolved by coordinator). */
  collectionProfile: CollectionProfileRefSchema.optional(),
};

/** Online surveying: agents stay online and create records on an interval. */
export const OnlineCollectionPhaseConfigSchema = z
  .object({
    /** Wall-clock pause between starting each record (approximate). */
    recordIntervalMs: z.number().int().positive().default(5000),
    /** Stop after N records even if durationMs not reached (optional cap). */
    maxRecords: z.number().int().positive().optional(),
    ...CollectionPhaseConfigFields,
  })
  .default({});

/**
 * Fully offline surveying, then reconnect and wait for sync (current offline +
 * sync-storm behaviour combined in one phase).
 */
export const OfflineCollectionPhaseConfigSchema = z
  .object({
    recordIntervalMs: z.number().int().positive().optional(),
    maxRecords: z.number().int().positive().optional(),
    /** Random delay before reconnect (0 … max), per agent. */
    reconnectJitterMaxMs: z.number().int().nonnegative().default(10000),
    /** Max wait for sync UI to return idle after reconnect. */
    syncTimeoutMs: z.number().int().positive().default(600000),
    ...CollectionPhaseConfigFields,
  })
  .default({});

/**
 * Patchy connectivity: agents toggle offline/online on a jittered cycle while
 * continuing to survey when online.
 */
export const PatchyNetworkPhaseConfigSchema = z
  .object({
    /** Mean time between connectivity toggles. */
    cycleMs: z.number().int().positive().default(30000),
    /** Random ± jitter applied to each cycle boundary. */
    cycleJitterMs: z.number().int().nonnegative().default(10000),
    /** How long each offline stint lasts (before going back online). */
    offlineDurationMs: z.number().int().positive().default(15000),
    /** Random ± jitter on offline stint length. */
    offlineJitterMs: z.number().int().nonnegative().default(5000),
    recordIntervalMs: z.number().int().positive().default(5000),
    maxRecords: z.number().int().positive().optional(),
    ...CollectionPhaseConfigFields,
  })
  .default({});

export const ExportStressPhaseConfigSchema = z
  .object({
    /** Fraction of agents that run export (0–1). Default: env PARTICIPATE_IN_EXPORT. */
    participateFraction: z.number().min(0).max(1).optional(),
  })
  .default({});

export const PhaseStepSchema = z.discriminatedUnion('kind', [
  StepBaseSchema.extend({
    kind: z.literal('onboarding'),
    advance: z.literal('all_agents_done').default('all_agents_done'),
    config: OnboardingPhaseConfigSchema,
  }),
  StepBaseSchema.extend({
    kind: z.literal('online_collection'),
    config: OnlineCollectionPhaseConfigSchema,
  }),
  StepBaseSchema.extend({
    kind: z.literal('offline_collection'),
    config: OfflineCollectionPhaseConfigSchema,
  }),
  StepBaseSchema.extend({
    kind: z.literal('patchy_network'),
    config: PatchyNetworkPhaseConfigSchema,
  }),
  StepBaseSchema.extend({
    kind: z.literal('export_stress'),
    config: ExportStressPhaseConfigSchema,
  }),
]);

export type PhaseStep = z.infer<typeof PhaseStepSchema>;

export type LoopStep = {
  id: string;
  label?: string;
  loop: {
    count: number;
    steps: SequenceNode[];
  };
};

export type SplitBranch = {
  id: string;
  label?: string;
  weight?: number;
  steps: SequenceNode[];
};

export type SplitStep = {
  id: string;
  label?: string;
  split: {
    assignment?: SplitAssignment;
    seed?: string;
    branches: SplitBranch[];
  };
  advance?: StepAdvanceMode;
  durationMs?: number;
};

export type SequenceNode = PhaseStep | LoopStep | SplitStep;

export const LoopStepSchema = z.lazy(() =>
  z.object({
    id: StepIdSchema,
    label: z.string().optional(),
    loop: z.object({
      count: z.number().int().positive(),
      steps: z.array(SequenceNodeSchema),
    }),
  })
);

export const SplitBranchSchema = z.lazy(() =>
  z.object({
    id: StepIdSchema,
    label: z.string().optional(),
    weight: z.number().int().positive().default(1),
    steps: z.array(SequenceNodeSchema),
  })
);

export const SplitStepSchema = z.lazy(() =>
  z.object({
    id: StepIdSchema,
    label: z.string().optional(),
    split: z.object({
      assignment: SplitAssignmentSchema.default('agent_index_mod'),
      seed: z.string().optional(),
      branches: z.array(SplitBranchSchema).min(2),
    }),
    advance: StepAdvanceModeSchema.default('all_agents_done'),
    durationMs: z.number().int().positive().optional(),
  })
);

export const SequenceNodeSchema: z.ZodType<SequenceNode> = z.lazy(() =>
  z.union([PhaseStepSchema, LoopStepSchema, SplitStepSchema])
) as z.ZodType<SequenceNode>;

export const SequencePlanSchema = z
  .object({
    version: SequencePlanVersionSchema,
    name: z.string().optional(),
    description: z.string().optional(),
    steps: z.array(SequenceNodeSchema).min(1),
  })
  .superRefine((plan, ctx) => {
    validateStepAdvanceTimers(plan.steps, ctx, []);
  });

export type SequencePlan = z.infer<typeof SequencePlanSchema>;
export type StepAdvanceMode = z.infer<typeof StepAdvanceModeSchema>;
export type SplitAssignment = z.infer<typeof SplitAssignmentSchema>;

/** True when advance mode requires an explicit `durationMs` on the step. */
function needsDuration(advance: StepAdvanceMode): boolean {
  return advance === 'timer' || advance === 'timer_or_all_done';
}

/** Recursively ensure timer-based steps declare `durationMs`. */
function validateStepAdvanceTimers(
  nodes: SequenceNode[],
  ctx: z.RefinementCtx,
  path: (string | number)[]
): void {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]!;
    const nodePath = [...path, i];

    if ('kind' in node) {
      if (needsDuration(node.advance) && node.durationMs === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `phase step "${node.id}" with advance=${node.advance} requires durationMs`,
          path: [...nodePath, 'durationMs'],
        });
      }
      continue;
    }

    if ('loop' in node) {
      validateStepAdvanceTimers(node.loop.steps, ctx, [...nodePath, 'loop', 'steps']);
      continue;
    }

    if ('split' in node) {
      const advance = node.advance ?? 'all_agents_done';
      if (needsDuration(advance) && node.durationMs === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `split step "${node.id}" with advance=${node.advance} requires durationMs`,
          path: [...nodePath, 'durationMs'],
        });
      }
      for (let b = 0; b < node.split.branches.length; b += 1) {
        validateStepAdvanceTimers(node.split.branches[b]!.steps, ctx, [
          ...nodePath,
          'split',
          'branches',
          b,
          'steps',
        ]);
      }
    }
  }
}

/** Parse and validate a sequence plan from JSON text. */
export function parseSequencePlan(json: string): SequencePlan {
  const raw: unknown = JSON.parse(json);
  return SequencePlanSchema.parse(raw);
}

/** Serialise a plan to compact JSON (suitable for SEQUENCE_PLAN env). */
export function serializeSequencePlan(plan: SequencePlan): string {
  return JSON.stringify(plan);
}

/** Serialise to base64 (suitable for SEQUENCE_PLAN_B64 env). */
export function serializeSequencePlanBase64(plan: SequencePlan): string {
  return Buffer.from(serializeSequencePlan(plan), 'utf8').toString('base64');
}

/** Parse from base64-encoded JSON. */
export function parseSequencePlanBase64(encoded: string): SequencePlan {
  const json = Buffer.from(encoded, 'base64').toString('utf8');
  return parseSequencePlan(json);
}

/**
 * Read a plan from `SEQUENCE_PLAN` or `SEQUENCE_PLAN_B64`.
 * Throws if neither is set or validation fails.
 */
export function parseSequencePlanFromEnv(
  env: Record<string, string | undefined> = process.env
): SequencePlan {
  const raw = env[SEQUENCE_PLAN_ENV_VAR]?.trim();
  if (raw) {
    return parseSequencePlan(raw);
  }
  const b64 = env[SEQUENCE_PLAN_B64_ENV_VAR]?.trim();
  if (b64) {
    return parseSequencePlanBase64(b64);
  }
  throw new Error(
    `Missing sequence plan: set ${SEQUENCE_PLAN_ENV_VAR} or ${SEQUENCE_PLAN_B64_ENV_VAR}`
  );
}

/** Like {@link parseSequencePlanFromEnv} but returns undefined when unset. */
export function tryParseSequencePlanFromEnv(
  env: Record<string, string | undefined> = process.env
): SequencePlan | undefined {
  try {
    return parseSequencePlanFromEnv(env);
  } catch {
    return undefined;
  }
}

