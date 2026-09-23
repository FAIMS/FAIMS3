import {relatedLinkWrites} from '../src/databaseEngine/utils';

const base = {
  fieldId: 'Related-Item',
  parentRecordId: 'parent-1',
  targetRecordId: 'target-1',
  targetRelationship: undefined,
  isMultiple: false,
};

describe('relatedLinkWrites', () => {
  it('writes the field value and the entry pointing back', () => {
    const {fieldValue, relationship} = relatedLinkWrites({
      ...base,
      relationType: 'faims-core::Linked',
      currentFieldValue: undefined,
    });
    expect(fieldValue).toEqual({
      record_id: 'target-1',
      relation_type_vocabPair: ['is linked to', 'is linked from'],
    });
    expect(relationship).toEqual({
      linked: [
        {
          fieldId: 'Related-Item',
          recordId: 'parent-1',
          relationTypeVocabPair: ['is linked to', 'is linked from'],
        },
      ],
    });
  });

  it('hangs a child off parent rather than linked', () => {
    const {relationship} = relatedLinkWrites({
      ...base,
      relationType: 'faims-core::Child',
      currentFieldValue: undefined,
    });
    expect(relationship.parent).toHaveLength(1);
    expect(relationship.linked).toBeUndefined();
  });

  const held = {
    record_id: 'target-0',
    relation_type_vocabPair: ['is linked to', 'is linked from'] as [
      string,
      string,
    ],
  };

  it('appends while the field takes many', () => {
    const {fieldValue} = relatedLinkWrites({
      ...base,
      isMultiple: true,
      relationType: 'faims-core::Linked',
      currentFieldValue: [held],
    });
    expect(fieldValue).toHaveLength(2);
  });

  it('refuses a second link on a field that takes one, rather than dropping the first', () => {
    // Replacing would leave the old target's entry pointing back at a record
    // that no longer names it. The engine refuses the same case on create.
    expect(() =>
      relatedLinkWrites({
        ...base,
        relationType: 'faims-core::Linked',
        currentFieldValue: [held],
      })
    ).toThrow(/already holds a record and takes only one/);
  });

  it('keeps the edges the target already had', () => {
    const {relationship} = relatedLinkWrites({
      ...base,
      relationType: 'faims-core::Linked',
      currentFieldValue: undefined,
      targetRelationship: {
        linked: [
          {
            fieldId: 'Other',
            recordId: 'other-1',
            relationTypeVocabPair: ['is linked to', 'is linked from'],
          },
        ],
      },
    });
    expect(relationship.linked).toHaveLength(2);
  });

  it('refuses a field value it cannot read, rather than dropping its links', () => {
    expect(() =>
      relatedLinkWrites({
        ...base,
        relationType: 'faims-core::Linked',
        currentFieldValue: 'not a link',
      })
    ).toThrow(/cannot be read/);
  });
});
