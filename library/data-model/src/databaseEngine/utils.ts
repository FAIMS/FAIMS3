import {FormRelationshipInstance, RelationshipInstance} from './types';

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
