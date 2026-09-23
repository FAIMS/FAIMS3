import {restrictVisibilityMap} from '../src/uiSpecification/utils';

describe('restrictVisibilityMap', () => {
  const visibilityMap = {
    Details: ['Name', 'Date', 'Notes'],
    Photos: ['Attachments'],
  };

  it('keeps only the sections the caller asked for', () => {
    expect(
      restrictVisibilityMap({
        visibilityMap,
        restrictTo: {Details: ['Name', 'Date', 'Notes']},
      })
    ).toEqual({Details: ['Name', 'Date', 'Notes']});
  });

  it('keeps only the fields the caller asked for', () => {
    expect(
      restrictVisibilityMap({
        visibilityMap,
        restrictTo: {Details: ['Name']},
      })
    ).toEqual({Details: ['Name']});
  });

  it('cannot show a section the conditions hid', () => {
    expect(
      restrictVisibilityMap({
        visibilityMap,
        restrictTo: {Details: ['Name'], Hidden: ['Anything']},
      })
    ).toEqual({Details: ['Name']});
  });

  it('cannot show a field the conditions removed', () => {
    expect(
      restrictVisibilityMap({
        visibilityMap,
        restrictTo: {Details: ['Name', 'HiddenByCondition']},
      })
    ).toEqual({Details: ['Name']});
  });

  it('drops a section whose fields all fall away, rather than heading nothing', () => {
    expect(
      restrictVisibilityMap({
        visibilityMap,
        restrictTo: {Details: ['Name'], Photos: ['Caption']},
      })
    ).toEqual({Details: ['Name']});
  });

  it('hides everything when nothing is asked for', () => {
    expect(restrictVisibilityMap({visibilityMap, restrictTo: {}})).toEqual({});
  });
});
