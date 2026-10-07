// SPDX-License-Identifier: Apache-2.0
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

/**
 * Survey facts the designer cannot derive from the ui-specification. Supplied by
 * the host app; empty by default so the designer still works standalone.
 */
export interface DesignerEditingContextValue {
  /**
   * Records already collected for the survey. Omitted for templates.
   *
   * Not read by any editor today. Previously gated the field-ID rename
   * warning; that warning went away when rename started writing `exportName`
   * only. Left in context so a future destructive-edit warning can subscribe
   * without rewiring the host.
   */
  existingRecordCount?: number;
  /** `designerIdentifier`s of the fields present when the session began. */
  originalFieldIdentifiers?: ReadonlySet<string>;
  /**
   * Fields that have already used (or opted out of) the one-shot
   * Label→export-name auto-sync. Owned by the provider so collapsing a field,
   * changing section, or otherwise remounting the editor cannot re-arm sync
   * and overwrite a custom export name.
   */
  consumedExportNameAutoSyncIds: Set<string>;
}

/** Host-supplied facts; the provider fills in session-local auto-sync state. */
export type DesignerEditingProviderValue = Omit<
  DesignerEditingContextValue,
  'consumedExportNameAutoSyncIds'
> & {
  consumedExportNameAutoSyncIds?: Set<string>;
};

const DesignerEditingContext = createContext<DesignerEditingContextValue>({
  consumedExportNameAutoSyncIds: new Set(),
});

export const DesignerEditingProvider = ({
  value,
  children,
}: {
  value: DesignerEditingProviderValue;
  children?: ReactNode;
}) => {
  const fallbackConsumedIds = useRef(new Set<string>()).current;
  const merged = useMemo<DesignerEditingContextValue>(
    () => ({
      ...value,
      consumedExportNameAutoSyncIds:
        value.consumedExportNameAutoSyncIds ?? fallbackConsumedIds,
    }),
    [value, fallbackConsumedIds]
  );
  return (
    <DesignerEditingContext.Provider value={merged}>
      {children}
    </DesignerEditingContext.Provider>
  );
};

export const useDesignerEditingContext = () =>
  useContext(DesignerEditingContext);

/**
 * True when the field was added during this session. Used to auto-sync
 * export name from Label once. Identifiers survive export-name edits. Defaults
 * to `false` when the set is unknown.
 */
export const useIsFieldNewInSession = (
  designerIdentifier?: string
): boolean => {
  const {originalFieldIdentifiers} = useDesignerEditingContext();
  // Missing set = host did not supply session facts (standalone / tests).
  // Empty set = the notebook had no fields at load; every added field is new.
  if (!originalFieldIdentifiers) {
    return false;
  }
  if (!designerIdentifier) return false;
  return !originalFieldIdentifiers.has(designerIdentifier);
};

/**
 * One-shot Label→export-name auto-sync for fields added this session.
 * `consume` is recorded on the editing context so remounting the field
 * editor cannot re-arm sync.
 */
export const useExportNameAutoSync = (designerIdentifier?: string) => {
  const isFieldNewInSession = useIsFieldNewInSession(designerIdentifier);
  const {consumedExportNameAutoSyncIds} = useDesignerEditingContext();
  const consumed =
    !!designerIdentifier &&
    consumedExportNameAutoSyncIds.has(designerIdentifier);

  const consume = useCallback(() => {
    if (designerIdentifier) {
      consumedExportNameAutoSyncIds.add(designerIdentifier);
    }
  }, [consumedExportNameAutoSyncIds, designerIdentifier]);

  return {
    pending: isFieldNewInSession && !consumed,
    consume,
  };
};
