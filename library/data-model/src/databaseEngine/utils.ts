import {
  relatedRecordAvpEntries,
  relatedRecordFieldAvpValueSchema,
  type FormRelationship,
  type FormRelationshipInstance,
  type RelatedRecordFieldAvpEntry,
  type RelatedRecordFieldAvpValue,
  type RelationshipInstance,
} from './types';

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
  relationType: string;
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
  const relationTypeVocabPair = relationTypeToPair(relationType);
  const links = readRelatedLinks(currentFieldValue);
  const link: RelatedRecordFieldAvpEntry = {
    record_id: targetRecordId,
    relation_type_vocabPair: relationTypeVocabPair,
  };
  const edge: FormRelationshipInstance = {
    fieldId,
    recordId: parentRecordId,
    relationTypeVocabPair,
  };
  // Child hangs the target off `parent`, every other relation off `linked`,
  // matching what the engine does when it creates one rather than links it.
  const relationship: FormRelationship =
    relationType === 'faims-core::Child'
      ? {
          ...targetRelationship,
          parent: [...(targetRelationship?.parent ?? []), edge],
        }
      : {
          ...targetRelationship,
          linked: [...(targetRelationship?.linked ?? []), edge],
        };
  return {
    fieldValue: withRelatedLink({links, link, isMultiple}),
    relationship,
  };
};
