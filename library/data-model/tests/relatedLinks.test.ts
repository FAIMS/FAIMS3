import {
  readRelatedLinks,
  relationTypeToPair,
  withRelatedLink,
} from '../src/databaseEngine/utils';

const link = {
  record_id: 'child-1',
  relation_type_vocabPair: ['has child', 'is child of'] as [string, string],
};

describe('relationTypeToPair', () => {
  it('names both ends of a child relation, the parent first', () => {
    expect(relationTypeToPair('faims-core::Child')).toEqual([
      'has child',
      'is child of',
    ]);
  });

  it('names both ends of a link', () => {
    expect(relationTypeToPair('faims-core::Linked')).toEqual([
      'is linked to',
      'is linked from',
    ]);
  });
});

describe('readRelatedLinks', () => {
  it('reads an empty field as holding nothing', () => {
    expect(readRelatedLinks(undefined)).toEqual([]);
    expect(readRelatedLinks(null)).toEqual([]);
  });

  it('reads a single stored entry as the list of one it stands for', () => {
    expect(readRelatedLinks(link)).toEqual([link]);
  });

  it('refuses a value it cannot read, rather than reporting no links', () => {
    // Reporting none would let the caller write over links already there.
    expect(() => readRelatedLinks('legacy-id')).toThrow(/cannot be read/);
  });
});

describe('withRelatedLink', () => {
  it('appends where the field holds many', () => {
    const existing = {...link, record_id: 'child-0'};
    expect(
      withRelatedLink({links: [existing], link, isMultiple: true})
    ).toEqual([existing, link]);
  });

  it('writes one bare entry where the field takes one, not a list of one', () => {
    expect(withRelatedLink({links: [], link, isMultiple: false})).toEqual(link);
  });
});
