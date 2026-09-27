/**
 * The walk down a record's Child-type links, and the links themselves.
 *
 * The status report and the recursive revision history both need this walk and
 * differ only in what they compute per node, so it lives here: the two cannot
 * disagree about what counts as a child, which records drop out, or how often
 * one is fetched.
 */
import {fieldIdsForViewset} from '../uiSpecification/formScan';
import {getChildRelationParams} from '../uiSpecification/parentForms';
import {DataEngine} from './engine';
import {
  DocumentNotFoundError,
  DocumentValidationError,
  NoHeadsError,
  UnknownFormTypeError,
} from './exceptions';
import {
  FormUpdateData,
  InitialFormData,
  relatedRecordAvpEntries,
  relatedRecordFieldAvpEntrySchema,
} from './types';

// Only the id and project tag matter here, so legacy vocab-pair drift in a
// stored link cannot invalidate a live child
const storedLinkEntrySchema = relatedRecordFieldAvpEntrySchema.pick({
  record_id: true,
  project_id: true,
});

/**
 * Converts one child's failure to load into a skip: a dangling, corrupt or
 * unmeasurable child cannot fail the whole walk. The same errors on the
 * root record still surface to the caller.
 */
export function absorbSkippableChildError(err: unknown): null {
  if (
    err instanceof DocumentNotFoundError ||
    err instanceof NoHeadsError ||
    err instanceof DocumentValidationError ||
    err instanceof UnknownFormTypeError
  ) {
    return null;
  }
  throw err;
}

export interface ChildFieldSpec {
  relatedFormId: string;
  required: boolean;
}

/** Resolves the Child-type RelatedRecordSelector fields of the ui-spec, keyed by field id. */
export function resolveChildFieldSpecs(
  uiSpec: DataEngine['uiSpec']
): Map<string, ChildFieldSpec> {
  const specs = new Map<string, ChildFieldSpec>();
  for (const [fieldId, fieldSpec] of Object.entries(uiSpec.fields)) {
    const params = getChildRelationParams(fieldSpec);
    if (!params) {
      continue;
    }
    specs.set(fieldId, {
      relatedFormId: params.related_type,
      // required is a base field param, outside the selector params schema
      required: !!fieldSpec['component-parameters']?.required,
    });
  }
  return specs;
}

/** One Child-type field of a form, and the records it links to. */
export interface ChildRecordLink {
  fieldId: string;
  relatedFormId: string;
  /** Distinct linked child ids; cross-project and malformed links excluded. */
  childIds: string[];
}

/**
 * The Child-type RelatedRecordSelector fields of a form and the child records
 * each links to, read from the parent's own stored values.
 *
 * @param uiSpec - The project's compiled ui specification
 * @param childFieldSpecs - Child-type fields, from {@link resolveChildFieldSpecs}
 * @param projectId - Links tagged with another project id are skipped
 * @param formId - The parent's form
 * @param data - The parent's stored values, absent on an empty record
 */
export function collectChildRecordLinks({
  uiSpec,
  childFieldSpecs,
  projectId,
  formId,
  data,
}: {
  uiSpec: DataEngine['uiSpec'];
  childFieldSpecs: Map<string, ChildFieldSpec>;
  projectId: string;
  formId: string;
  data: FormUpdateData | undefined;
}): ChildRecordLink[] {
  const links: ChildRecordLink[] = [];
  // Set: a field listed in two sections is still one child field
  for (const fieldId of new Set(fieldIdsForViewset(uiSpec, formId))) {
    const spec = childFieldSpecs.get(fieldId);
    if (!spec) {
      continue;
    }
    // An absent value flattens to [undefined], which the schema then rejects
    const rawEntries = relatedRecordAvpEntries(data?.[fieldId]?.data);
    // Set: an empty id is not a child; a duplicate link is still one child
    const childIds = new Set<string>();
    for (const rawEntry of rawEntries) {
      const entry = storedLinkEntrySchema.safeParse(rawEntry);
      if (!entry.success) {
        continue;
      }
      const {record_id: childId, project_id: linkProjectId} = entry.data;
      // An empty-string tag means untagged, like an absent one
      if (linkProjectId && linkProjectId !== projectId) {
        continue;
      }
      if (childId) {
        childIds.add(childId);
      }
    }
    links.push({
      fieldId,
      relatedFormId: spec.relatedFormId,
      childIds: [...childIds],
    });
  }
  return links;
}

export interface ChildTreeWalkContext {
  engine: DataEngine;
  projectId: string;
  /** Child-type fields resolved once per walk; the ui-spec never changes mid-walk. */
  childFieldSpecs: Map<string, ChildFieldSpec>;
}

/**
 * Walks a record and, recursively, the records its Child-type fields link to,
 * fetching each record once however many fields link it. A single hydration
 * per node fetches the record, head revision and AVPs together.
 *
 * @param ctx - Engine, project and the ui-spec's Child-type fields
 * @param recordId - Record this node reports on
 * @param path - Records on the path from the root; cuts the cycles corrupt
 *   data can hold. Pass an empty set at the root
 * @param startOwnWork - The node's own reads or scoring, started before its
 *   children are walked so the two overlap
 * @param buildNode - Composes the node from its own work and its children's
 *   outcomes
 * @returns null when the record is deleted or would close a cycle (results
 *   under a cut are best-effort and can vary with link order)
 * @throws UnknownFormTypeError if the record's form is not in the ui-spec
 */
export async function walkChildRecordTree<TNode, TOwn>({
  ctx,
  recordId,
  path,
  startOwnWork,
  buildNode,
}: {
  ctx: ChildTreeWalkContext;
  recordId: string;
  path: ReadonlySet<string>;
  startOwnWork: (args: {
    recordId: string;
    node: InitialFormData;
  }) => TOwn | Promise<TOwn>;
  buildNode: (args: {
    recordId: string;
    node: InitialFormData;
    own: TOwn;
    links: ChildRecordLink[];
    /** One entry per distinct linked child; null where the child dropped out. */
    outcomes: ReadonlyMap<string, TNode | null>;
  }) => TNode;
}): Promise<TNode | null> {
  if (path.has(recordId)) {
    return null;
  }
  const {engine} = ctx;

  // Default conflict resolution (pickFirst), like the record page's own reads,
  // so a conflicted record is walked as the head the form shows
  const node = await engine.form.getExistingFormData({recordId});
  if (node.context.revision.deleted) {
    return null;
  }
  // hasOwnProperty, since `in` also matches prototype keys ('constructor')
  if (
    !Object.prototype.hasOwnProperty.call(engine.uiSpec.viewsets, node.formId)
  ) {
    throw new UnknownFormTypeError(recordId, node.formId);
  }

  const links = collectChildRecordLinks({
    uiSpec: engine.uiSpec,
    childFieldSpecs: ctx.childFieldSpecs,
    projectId: ctx.projectId,
    formId: node.formId,
    data: node.data,
  });

  // Branches are independent (each carries its own path copy), so they walk
  // concurrently, and alongside this node's own work: awaiting them together
  // keeps a rejection from either side handled
  const childPath = new Set(path).add(recordId);
  const outcomes = new Map<string, TNode | null>();
  let own!: TOwn;
  await Promise.all([
    (async () => {
      own = await startOwnWork({recordId, node});
    })(),
    ...[...new Set(links.flatMap(link => link.childIds))].map(async childId => {
      try {
        outcomes.set(
          childId,
          await walkChildRecordTree({
            ctx,
            recordId: childId,
            path: childPath,
            startOwnWork,
            buildNode,
          })
        );
      } catch (err) {
        outcomes.set(childId, absorbSkippableChildError(err));
      }
    }),
  ]);

  return buildNode({recordId, node, own, links, outcomes});
}
