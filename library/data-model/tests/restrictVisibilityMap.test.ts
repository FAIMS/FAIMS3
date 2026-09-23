import {restrictVisibilityMap} from '../src/uiSpecification/utils';

describe('restrictVisibilityMap', () => {
  const visibilityMap = {
    Header: ['Oven', 'Balance', 'Standard'],
    Trays: ['TrayList'],
  };

  it('keeps only the sections the caller asked for', () => {
    expect(
      restrictVisibilityMap({
        visibilityMap,
        restrictTo: {Header: ['Oven', 'Balance', 'Standard']},
      })
    ).toEqual({Header: ['Oven', 'Balance', 'Standard']});
  });

  it('keeps only the fields the caller asked for', () => {
    expect(
      restrictVisibilityMap({
        visibilityMap,
        restrictTo: {Header: ['Oven']},
      })
    ).toEqual({Header: ['Oven']});
  });

  it('cannot show a section the conditions hid', () => {
    expect(
      restrictVisibilityMap({
        visibilityMap,
        restrictTo: {Header: ['Oven'], Hidden: ['Anything']},
      })
    ).toEqual({Header: ['Oven']});
  });

  it('cannot show a field the conditions removed', () => {
    expect(
      restrictVisibilityMap({
        visibilityMap,
        restrictTo: {Header: ['Oven', 'RemovedByCondition']},
      })
    ).toEqual({Header: ['Oven']});
  });

  it('drops a section whose fields all fall away, rather than heading nothing', () => {
    expect(
      restrictVisibilityMap({
        visibilityMap,
        restrictTo: {Header: ['Oven'], Trays: ['SomethingElse']},
      })
    ).toEqual({Header: ['Oven']});
  });

  it('hides everything when nothing is asked for', () => {
    expect(restrictVisibilityMap({visibilityMap, restrictTo: {}})).toEqual({});
  });
});
