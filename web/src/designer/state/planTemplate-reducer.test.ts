/**
 * @file Tests for the planTemplate partition slice.
 */
import {describe, expect, it} from 'vitest';
import reducer, {
  planTemplateLoaded,
  planTemplateRemoved,
  planTemplateSet,
} from './planTemplate-reducer';

const countedTemplate = {planType: 'Counted', formType: 'FORM1'};

describe('planTemplate reducer', () => {
  it('has null initial state', () => {
    expect(reducer(undefined, {type: 'noop'})).toBeNull();
  });

  it('replaces state with the payload on loaded', () => {
    expect(reducer(null, planTemplateLoaded(countedTemplate))).toEqual(
      countedTemplate
    );
  });

  it('clears state on loaded with null', () => {
    expect(reducer(countedTemplate, planTemplateLoaded(null))).toBeNull();
  });

  it('replaces an existing plan template wholesale on set', () => {
    const replacement = {
      planType: 'ListOfRecords',
      formType: 'FORM2',
      recordFields: ['field-a'],
    };
    expect(reducer(countedTemplate, planTemplateSet(replacement))).toEqual(
      replacement
    );
  });

  it('resets to null on removed', () => {
    expect(reducer(countedTemplate, planTemplateRemoved())).toBeNull();
  });
});
