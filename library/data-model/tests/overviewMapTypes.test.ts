import type {UiSpecModel} from '../src/uiSpecification/types';
import {
  getOverviewMapTypes,
  isFormDisplayedInOverviewMap,
} from '../src/uiSpecification/utils';

const createUiSpec = (
  viewsets: UiSpecModel['viewsets']
): UiSpecModel => ({
  fields: {},
  views: {},
  viewsets,
  visible_types: Object.keys(viewsets),
});

describe('overview map form type visibility', () => {
  it('includes form types by default when displayInOverviewMap is unset', () => {
    const uiSpec = createUiSpec({
      site: {views: [], label: 'Site'},
      photo: {views: [], label: 'Photo', displayInOverviewMap: false},
    });

    expect(isFormDisplayedInOverviewMap(uiSpec, 'site')).toBe(true);
    expect(isFormDisplayedInOverviewMap(uiSpec, 'photo')).toBe(false);
    expect(getOverviewMapTypes(uiSpec)).toEqual(['site']);
  });

  it('returns false for unknown form types', () => {
    const uiSpec = createUiSpec({
      site: {views: [], label: 'Site'},
    });

    expect(isFormDisplayedInOverviewMap(uiSpec, 'missing')).toBe(false);
  });
});
