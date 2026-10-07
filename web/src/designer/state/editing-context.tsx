// SPDX-License-Identifier: Apache-2.0
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';

/**
 * Survey facts the designer cannot derive from the ui-specification. Supplied by
 * the host app; empty by default so the designer still works standalone.
 */
export interface DesignerEditingContextValue {
  /** Records already collected for the survey. Omitted for templates. */
  existingRecordCount?: number;
  /** `designerIdentifier`s of the fields present when the session began. */
  originalFieldIdentifiers?: ReadonlySet<string>;
  /** True after this field used (or skipped) its one first-commit auto-sync. */
  hasConsumedFieldIdAutoSync: (designerIdentifier: string) => boolean;
  /** Permanently disarms Label → Field ID auto-sync for this field. */
  consumeFieldIdAutoSync: (designerIdentifier: string) => void;
}

const noopHasConsumed = () => false;
const noopConsume = () => undefined;

const DesignerEditingContext = createContext<DesignerEditingContextValue>({
  hasConsumedFieldIdAutoSync: noopHasConsumed,
  consumeFieldIdAutoSync: noopConsume,
});

/**
 * Session-scoped designer facts, including which fields already spent their
 * first-commit Field ID auto-sync. Resets when `sessionKey` changes.
 */
export function DesignerEditingProvider({
  existingRecordCount,
  originalFieldIdentifiers,
  sessionKey,
  children,
}: {
  existingRecordCount?: number;
  originalFieldIdentifiers?: ReadonlySet<string>;
  sessionKey?: string;
  children: ReactNode;
}) {
  const consumedRef = useRef(new Set<string>());

  useEffect(() => {
    consumedRef.current = new Set();
  }, [sessionKey]);

  const hasConsumedFieldIdAutoSync = useCallback(
    (designerIdentifier: string) => consumedRef.current.has(designerIdentifier),
    []
  );
  const consumeFieldIdAutoSync = useCallback((designerIdentifier: string) => {
    consumedRef.current.add(designerIdentifier);
  }, []);

  const value = useMemo(
    () => ({
      existingRecordCount,
      originalFieldIdentifiers,
      hasConsumedFieldIdAutoSync,
      consumeFieldIdAutoSync,
    }),
    [
      existingRecordCount,
      originalFieldIdentifiers,
      hasConsumedFieldIdAutoSync,
      consumeFieldIdAutoSync,
    ]
  );

  return (
    <DesignerEditingContext.Provider value={value}>
      {children}
    </DesignerEditingContext.Provider>
  );
}

export const useDesignerEditingContext = () =>
  useContext(DesignerEditingContext);

/**
 * True when the field was added during this session, so it cannot hold data and
 * its Field ID is safe to change. Identifiers survive renames. Defaults to
 * `false` when the set is unknown, so a real warning is never suppressed.
 */
export const useIsFieldNewInSession = (
  designerIdentifier?: string
): boolean => {
  const {originalFieldIdentifiers} = useDesignerEditingContext();
  if (!originalFieldIdentifiers || originalFieldIdentifiers.size === 0) {
    return false;
  }
  if (!designerIdentifier) return false;
  return !originalFieldIdentifiers.has(designerIdentifier);
};
