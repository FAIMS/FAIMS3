import type {RelatedType} from '../uiSpecification/types';
import {
  relatedRecordAvpEntries,
  relatedRecordFieldAvpValueSchema,
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
