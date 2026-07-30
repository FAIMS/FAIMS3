import {createContext, useContext} from 'react';

/**
 * Survey facts the designer cannot derive from the ui-specification. Supplied by
 * the host app; empty by default so the designer still works standalone.
 */
export interface DesignerEditingContextValue {
  /** Records already collected for the survey. Omitted for templates. */
  existingRecordCount?: number;
  /** `designerIdentifier`s of the fields present when the session began. */
  originalFieldIdentifiers?: ReadonlySet<string>;
}

const DesignerEditingContext = createContext<DesignerEditingContextValue>({});

export const DesignerEditingProvider = DesignerEditingContext.Provider;

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
