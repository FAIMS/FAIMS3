/**
 * @file Tests for the planTemplates partition slice.
 */
import {describe, expect, it} from 'vitest';
import reducer, {
  planTemplateAdded,
  planTemplateLabelled,
  planTemplateMoved,
  planTemplateRemoved,
  planTemplateSet,
} from './planTemplates-reducer';

const counted = {planType: 'Counted', formType: 'FORM1'};
const listed = {
  planType: 'ListOfRecords',
  formType: 'FORM2',
  recordFields: ['field-a'],
};

describe('planTemplates reducer', () => {
  it('has an empty initial state', () => {
    expect(reducer(undefined, {type: 'noop'})).toEqual([]);
  });

  it('appends on added, keeping declared order', () => {
    const state = reducer(
      reducer([], planTemplateAdded(counted)),
      planTemplateAdded(listed)
    );
    expect(state).toEqual([counted, listed]);
  });

  it('replaces one plan template in place on set', () => {
    const state = reducer(
      [counted, listed],
      planTemplateSet({index: 0, planTemplate: listed})
    );
    expect(state).toEqual([listed, listed]);
  });

  it('sets and clears a label', () => {
    const labelled = reducer(
      [counted],
      planTemplateLabelled({index: 0, label: 'Artefacts'})
    );
    expect(labelled[0].label).toBe('Artefacts');
    const cleared = reducer(
      labelled,
      planTemplateLabelled({index: 0, label: ''})
    );
    expect('label' in cleared[0]).toBe(false);
  });

  it('removes by index', () => {
    expect(reducer([counted, listed], planTemplateRemoved(0))).toEqual([
      listed,
    ]);
  });

  it('moves a plan template and leaves the ends alone', () => {
    expect(
      reducer([counted, listed], planTemplateMoved({index: 1, delta: -1}))
    ).toEqual([listed, counted]);
    expect(
      reducer([counted, listed], planTemplateMoved({index: 0, delta: -1}))
    ).toEqual([counted, listed]);
  });
});
