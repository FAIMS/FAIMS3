import {renderHook} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {
  ExplicitParentNavInfo,
  ImpliedParentNavInfo,
  NavigationService,
  UseNavigationLogicParams,
} from './types';
import {useNavigationLogic} from './useNavigationLogic';

const toRecord = vi.fn();
const navigateToRecordList = vi.fn();
const navigateToImpliedParent = vi.fn();

const navigationService: NavigationService = {
  toRecord,
  navigateToRecordList: {navigate: navigateToRecordList},
};

/** The parent the user walked through to reach this record. */
const explicitParentInfo: ExplicitParentNavInfo = {
  link: '/records/parent-1',
  mode: 'parent',
  recordId: 'parent-1',
  label: 'Site SIT-1',
  fieldId: 'site-samples',
  formId: 'Site',
  relationType: 'parent',
};

/** A parent inferred from the record's own relationship field. */
const impliedParent: ImpliedParentNavInfo = {
  type: 'parent',
  recordId: 'parent-2',
  fieldId: 'site-samples',
  formId: 'Site',
  label: 'SIT-2',
  onNavigate: navigateToImpliedParent,
};

/** The hook as a child record reaches it, with both kinds of parent link. */
const renderNavigation = (
  overrides: Partial<UseNavigationLogicParams> = {}
) => {
  toRecord.mockClear();
  navigateToRecordList.mockClear();
  navigateToImpliedParent.mockClear();
  return renderHook(() =>
    useNavigationLogic({
      currentFormLabel: 'Density',
      navigationType: 'child',
      explicitParentInfo,
      navigationService,
      flushSave: async () => {},
      hasPendingSave: false,
      isFormSaving: false,
      impliedParents: [impliedParent],
      ...overrides,
    })
  );
};

const buttonIds = (result: {current: {buttons: {id: string}[]}}) =>
  result.current.buttons.map(button => button.id);

describe('suppressing parent navigation', () => {
  it('offers both ways out to a parent by default', () => {
    const {result} = renderNavigation();
    expect(buttonIds(result)).toEqual([
      'finish-to-parent',
      'implied-parent-parent-2',
    ]);
  });

  it('drops both ways out to a parent when the caller turns them off', () => {
    const {result} = renderNavigation({shouldShowParentNavigation: false});
    expect(buttonIds(result)).toEqual(['finish-to-list']);
  });

  it('sends the primary action to the record list once they are off', async () => {
    const {result} = renderNavigation({shouldShowParentNavigation: false});
    await result.current.buttons[0].onClick();
    expect(navigateToRecordList).toHaveBeenCalled();
    expect(toRecord).not.toHaveBeenCalled();
  });

  it('sends the completion handler there too, so Finish stays in the flow', async () => {
    const {result} = renderNavigation({shouldShowParentNavigation: false});
    await result.current.onCompleteHandler.onClick();
    expect(navigateToRecordList).toHaveBeenCalled();
    expect(toRecord).not.toHaveBeenCalled();
  });

  it('keeps creating another sibling, which stays inside the flow', () => {
    const {result} = renderNavigation({
      shouldShowParentNavigation: false,
      createAnotherChild: {
        formLabel: 'Density',
        parentFormLabel: 'Site',
        fieldLabel: 'Site samples',
        onCreate: vi.fn(),
        relationType: 'parent',
      },
    });
    expect(buttonIds(result)).toEqual([
      'finish-to-list',
      'create-another-child',
    ]);
  });
});
