import {z} from 'zod';

/**
 * Collection profile (v1) — describes how agents fill in one record during
 * load-test collection phases.
 *
 * Profiles live in `shared/collection-profiles/` and are referenced from
 * sequence plan phase `config.collectionProfile`. The coordinator resolves
 * filename strings to full objects before agents receive steps.
 */

export const COLLECTION_PROFILES_DIR_ENV_VAR = 'COLLECTION_PROFILES_DIR';

export const CollectionProfileVersionSchema = z.literal(1);

const StepTimingSchema = z.object({
  /** Human-readable label for agent logs. */
  label: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  /** When true, a failed/missing step is skipped instead of failing the record. */
  optional: z.boolean().optional(),
  retry: z.number().int().nonnegative().optional(),
  retryDelayMs: z.number().int().nonnegative().optional(),
});

export const FillStepSchema = StepTimingSchema.extend({
  action: z.literal('fill'),
  /** uiSpec field id (DOM anchor: `#field-{field}`). */
  field: z.string().min(1),
  value: z.string(),
  multiline: z.boolean().optional(),
});

export const SelectStepSchema = StepTimingSchema.extend({
  action: z.literal('select'),
  field: z.string().min(1),
  /** Option label or value as shown in the dropdown. */
  option: z.string().min(1),
});

export const ToggleStepSchema = StepTimingSchema.extend({
  action: z.literal('toggle'),
  field: z.string().min(1),
  checked: z.boolean(),
  /** Match a labelled checkbox or radio within the field (e.g. expanded MultiSelect). */
  option: z.string().min(1).optional(),
});

export const NavigateSectionStepSchema = StepTimingSchema.extend({
  action: z.literal('navigate_section'),
  section: z.string().min(1),
  match: z.enum(['label', 'id']).optional(),
});

export const ScrollToFieldStepSchema = StepTimingSchema.extend({
  action: z.literal('scroll_to_field'),
  field: z.string().min(1),
});

export const WaitStepSchema = StepTimingSchema.extend({
  action: z.literal('wait'),
  ms: z.number().int().nonnegative(),
});

export const WaitSaveStepSchema = StepTimingSchema.extend({
  action: z.literal('wait_save'),
});

export const FinishStepSchema = StepTimingSchema.extend({
  action: z.literal('finish'),
  strategy: z.enum(['finish_anyway', 'complete', 'go_back']).optional(),
});

const LeafCollectionStepSchema = z.discriminatedUnion('action', [
  FillStepSchema,
  SelectStepSchema,
  ToggleStepSchema,
  NavigateSectionStepSchema,
  ScrollToFieldStepSchema,
  WaitStepSchema,
  WaitSaveStepSchema,
  FinishStepSchema,
]);

const GroupStepBaseSchema = StepTimingSchema.extend({
  action: z.literal('group'),
});

export const CollectionStepSchema: z.ZodTypeAny = z.lazy(() =>
  z.union([
    LeafCollectionStepSchema,
    GroupStepBaseSchema.extend({
      steps: z.array(CollectionStepSchema).min(1),
    }),
  ])
);

export type CollectionStep = z.infer<typeof CollectionStepSchema>;

export const CollectionProfileOnFailureSchema = z.enum([
  'abort_record',
  'finish_anyway',
  'skip_record',
]);

export const CollectionProfileSchema = z.object({
  version: CollectionProfileVersionSchema,
  name: z.string().optional(),
  description: z.string().optional(),
  /** Viewset id when the notebook exposes multiple record types. */
  formType: z.string().min(1).optional(),
  onFailure: CollectionProfileOnFailureSchema.default('finish_anyway'),
  record: z.object({
    steps: z.array(CollectionStepSchema).min(1),
  }),
});

export type CollectionProfile = z.infer<typeof CollectionProfileSchema>;

/** Inline profile object or filename resolved by the coordinator. */
export const CollectionProfileRefSchema = z.union([
  z.string().min(1),
  CollectionProfileSchema,
]);

export type CollectionProfileRef = z.infer<typeof CollectionProfileRefSchema>;

export const COLLECTION_PHASE_KINDS = [
  'online_collection',
  'offline_collection',
  'patchy_network',
] as const;

export type CollectionPhaseKind = (typeof COLLECTION_PHASE_KINDS)[number];

/** True when a phase kind supports `config.collectionProfile`. */
export function isCollectionPhaseKind(kind: string): kind is CollectionPhaseKind {
  return (COLLECTION_PHASE_KINDS as readonly string[]).includes(kind);
}

/** Parse and validate a collection profile from JSON text. */
export function parseCollectionProfile(json: string): CollectionProfile {
  const raw: unknown = JSON.parse(json);
  return CollectionProfileSchema.parse(raw);
}

/** DOM id used by FAIMS forms for field scroll targets. */
export function fieldDomId(fieldId: string): string {
  return `field-${fieldId}`;
}
