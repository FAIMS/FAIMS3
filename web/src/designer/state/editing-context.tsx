import {createContext, useContext} from 'react';

/**
 * Facts about the survey being edited that the designer cannot derive from the
 * ui-specification itself. Supplied by the host app; empty by default so the
 * designer keeps working standalone (and for templates, which hold no records).
 */
export interface DesignerEditingContextValue {
  /** Records already collected for the survey. Undefined when not applicable. */
  existingRecordCount?: number;
  /**
   * `designerIdentifier`s of the fields that were present when this editing
   * session began. A field's identifier is stable across renames, so a field
   * added during the session is absent from this set — letting us change its
   * Field ID without a data-loss warning (no records were ever collected
   * against it). Undefined when the host does not supply it (e.g. standalone
   * designer or templates), in which case we fall back to treating every field
   * as pre-existing so a genuine warning is never suppressed.
   */
  originalFieldIdentifiers?: ReadonlySet<string>;
}

const DesignerEditingContext = createContext<DesignerEditingContextValue>({});

export const DesignerEditingProvider = DesignerEditingContext.Provider;

export const useDesignerEditingContext = () =>
  useContext(DesignerEditingContext);

/**
 * True when the field identified by `designerIdentifier` was added during this
 * editing session (so it cannot have any collected data, and changing its Field
 * ID is safe). Returns `false` — "treat as pre-existing" — whenever the original
 * set is unknown or the identifier is missing, so a real data-loss warning is
 * never suppressed by absent context.
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
