import {
  relatedRecordAvpEntries,
  relatedRecordFieldAvpValueSchema,
  type FormRelationship,
  type FormRelationshipInstance,
  type RelatedRecordFieldAvpEntry,
  type RelatedRecordFieldAvpValue,
  type RelationshipInstance,
} from './types';
import type {RelatedType} from '../uiSpecification/types';

// If there is no vocab pair - we use this as a placeholder
export const DEFAULT_VOCAB_PAIR: [string, string] = [
  'is related to',
  'is related to',
] as const;

// Helper function to normalize relationship instances to array
export const normalizeRelationshipInstances = (
  instances: RelationshipInstance | RelationshipInstance[] | undefined
): FormRelationshipInstance[] | undefined => {
  if (!instances) return undefined;

  const arr = Array.isArray(instances) ? instances : [instances];
  return arr.map(inst => {
    let vocabPair = inst.relation_type_vocabPair;
    if (vocabPair.length === 0) {
      vocabPair = DEFAULT_VOCAB_PAIR;
    }
    return {
      fieldId: inst.field_id,
      recordId: inst.record_id,
      relationTypeVocabPair: vocabPair,
    };
  });
};

// Helper to convert FormRelationshipInstance[] back to DB format
export const toDbRelationshipInstances = (
  instances: FormRelationshipInstance[] | undefined
): RelationshipInstance[] | undefined => {
  if (!instances || instances.length === 0) return undefined;
  return instances.map(inst => ({
    field_id: inst.fieldId,
    record_id: inst.recordId,
    relation_type_vocabPair: inst.relationTypeVocabPair,
  }));
};

/**
 * The vocab pair a relation type carries, the parent's view first. Authored
 * notebooks do not name one, so the relation type is the whole input.
 */
export const relationTypeToPair = (relationType: string): [string, string] =>
  relationType === 'faims-core::Child'
    ? ['has child', 'is child of']
    : ['is linked to', 'is linked from'];

/**
 * The links a related-record field currently holds. A field storing one holds
 * a bare entry rather than a list of one, so both shapes read alike here.
 * Throws on a value it cannot read: appending to that would drop the links
 * already in it, and refusing is better than writing over them.
 */
export const readRelatedLinks = (
  /** The field's stored value, straight off the revision, so of no known shape. */
  current: unknown
): RelatedRecordFieldAvpEntry[] => {
  if (current === undefined || current === null) return [];
  const parsed = relatedRecordFieldAvpValueSchema.safeParse(current);
  if (!parsed.success) {
    throw new Error('Field holds a related-record value that cannot be read');
  }
  return relatedRecordAvpEntries(parsed.data);
};

/** The value a field holds once `link` joins `links`, in the shape it stores. */
export const withRelatedLink = ({
  links,
  link,
  isMultiple,
}: {
  links: RelatedRecordFieldAvpEntry[];
  link: RelatedRecordFieldAvpEntry;
  isMultiple: boolean;
}): RelatedRecordFieldAvpValue => (isMultiple ? [...links, link] : link);

/**
 * Both halves of linking an existing record through a related-record field.
 *
 * A link is two writes, not one: the field's own value gains the target, and
 * the target's revision gains the entry pointing back. Miss the second and the
 * link reads correctly from the field while the target cannot see what points
 * at it, which is the direction a roll-up has to travel.
 *
 * Pure, so the two callers that persist differently can still agree on what a
 * link means: a form field writes `fieldValue` through form state, while a
 * caller outside a form writes it through the engine.
 */

/**
 * What linking and creating a related record both have to work out: the
 * refusal, the vocabulary pair, and the edge the target gains. Shared so that
 * creating a child and linking one cannot disagree about what a link means.
 *
 * Throws when a field that takes one link already holds one. Replacing it
 * instead would drop a link while leaving the old target's entry pointing back,
 * and a caller that means to replace can detach first.
 */
export const relatedLinkParts = ({
  fieldId,
  relationType,
  parentRecordId,
  currentFieldValue,
  isMultiple,
}: {
  /** The related-record field on the parent doing the linking. */
  fieldId: string;
  /** The field's `relation_type`; Child hangs the target off `parent`. */
  relationType: RelatedType;
  /** The record whose field gains the link. */
  parentRecordId: string;
  /** What the field holds now, straight off the revision. */
  currentFieldValue: unknown;
  /** Whether the field takes more than one link. */
  isMultiple: boolean;
}): {
  links: RelatedRecordFieldAvpEntry[];
  relationTypeVocabPair: [string, string];
  edge: FormRelationshipInstance;
  isChild: boolean;
} => {
  const links = readRelatedLinks(currentFieldValue);
  if (!isMultiple && links.length > 0) {
    throw new Error(
      `Field ${fieldId} already holds a record and takes only one`
    );
  }
  const relationTypeVocabPair = relationTypeToPair(relationType);
  return {
    links,
    relationTypeVocabPair,
    edge: {fieldId, recordId: parentRecordId, relationTypeVocabPair},
    isChild: relationType === 'faims-core::Child',
  };
};

/**
 * A relationship with one more edge on it. Child hangs off `parent`, every
 * other relation off `linked`. Called with no relationship for a record being
 * created, which is the same edge in its first revision.
 */
export const withRelatedEdge = ({
  relationship,
  edge,
  isChild,
}: {
  relationship: FormRelationship | undefined;
  edge: FormRelationshipInstance;
  isChild: boolean;
}): FormRelationship =>
  isChild
    ? {...relationship, parent: [...(relationship?.parent ?? []), edge]}
    : {...relationship, linked: [...(relationship?.linked ?? []), edge]};

export const relatedLinkWrites = ({
  fieldId,
  relationType,
  parentRecordId,
  targetRecordId,
  currentFieldValue,
  targetRelationship,
  isMultiple,
}: {
  /** The related-record field on the parent doing the linking. */
  fieldId: string;
  /** The field's `relation_type`; Child hangs the target off `parent`. */
  relationType: RelatedType;
  /** The record whose field gains the link. */
  parentRecordId: string;
  /** The existing record being linked to. */
  targetRecordId: string;
  /** What the field holds now, straight off the revision. */
  currentFieldValue: unknown;
  /** The target revision's relationship, so existing edges survive. */
  targetRelationship: FormRelationship | undefined;
  /** Whether the field takes more than one link. */
  isMultiple: boolean;
}): {
  /** What the parent's field must hold now. */
  fieldValue: RelatedRecordFieldAvpValue;
  /** What the target's revision relationship must hold now. */
  relationship: FormRelationship;
} => {
  const {links, relationTypeVocabPair, edge, isChild} = relatedLinkParts({
    fieldId,
    relationType,
    parentRecordId,
    currentFieldValue,
    isMultiple,
  });
  const link: RelatedRecordFieldAvpEntry = {
    record_id: targetRecordId,
    relation_type_vocabPair: relationTypeVocabPair,
  };
  return {
    fieldValue: withRelatedLink({links, link, isMultiple}),
    relationship: withRelatedEdge({
      relationship: targetRelationship,
      edge,
      isChild,
    }),
  };
};
