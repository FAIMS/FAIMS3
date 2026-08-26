/**
 * @file Tests for the planTemplate partition slice.
 */
import {describe, expect, it} from 'vitest';
import reducer, {
  planTemplateRemoved,
  planTemplateSet,
} from './planTemplate-reducer';

const countedTemplate = {planType: 'Counted', formType: 'FORM1'};

describe('planTemplate reducer', () => {
  it('has null initial state', () => {
    expect(reducer(undefined, {type: 'noop'})).toBeNull();
  });

  it('sets a plan template from nothing on set', () => {
    expect(reducer(null, planTemplateSet(countedTemplate))).toEqual(
      countedTemplate
    );
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
