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

// What a plan dialog emits: type fields only, no id.
const counted = {planType: 'Counted', formType: 'FORM1'};
const listed = {
  planType: 'ListOfRecords',
  formType: 'FORM2',
  recordFields: ['field-a'],
};

/** The stored row `planTemplateAdded` makes of an authored plan template. */
const stored = (authored: {planType: string}, planId = authored.planType) => ({
  ...authored,
  planId,
});

describe('planTemplates reducer', () => {
  it('has an empty initial state', () => {
    expect(reducer(undefined, {type: 'noop'})).toEqual([]);
  });

  it('appends on added, keeping declared order', () => {
    const state = reducer(
      reducer([], planTemplateAdded(counted)),
      planTemplateAdded(listed)
    );
    expect(state).toEqual([stored(counted), stored(listed)]);
  });

  it('mints an id per plan, disambiguating a second of the same type', () => {
    const state = reducer(
      reducer([], planTemplateAdded(counted)),
      planTemplateAdded(counted)
    );
    expect(state.map(p => p.planId)).toEqual(['Counted', 'Counted-2']);
  });

  it('replaces one plan template in place on set', () => {
    const state = reducer(
      [stored(counted), stored(listed)],
      planTemplateSet({index: 0, planTemplate: listed})
    );
    expect(state).toEqual([{...listed, planId: 'Counted'}, stored(listed)]);
  });

  it('keeps the label and id an edit dialog does not author', () => {
    // Plan dialogs emit only their own type's fields.
    const state = reducer(
      [{...counted, planId: 'field-cells', label: 'Artefacts'}],
      planTemplateSet({
        index: 0,
        planTemplate: {planType: 'Counted', formType: 'FORM2'},
      })
    );
    expect(state[0]).toEqual({
      planId: 'field-cells',
      label: 'Artefacts',
      planType: 'Counted',
      formType: 'FORM2',
    });
  });

  it('sets and clears a label', () => {
    const labelled = reducer(
      [stored(counted)],
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
    expect(
      reducer([stored(counted), stored(listed)], planTemplateRemoved(0))
    ).toEqual([stored(listed)]);
  });

  it('moves a plan template and leaves the ends alone', () => {
    // Ids ride along with their own plan, so a reorder cannot re-address one.
    const state = [stored(counted), stored(listed)];
    expect(reducer(state, planTemplateMoved({index: 1, delta: -1}))).toEqual([
      stored(listed),
      stored(counted),
    ]);
    expect(reducer(state, planTemplateMoved({index: 0, delta: -1}))).toEqual(
      state
    );
  });
});
