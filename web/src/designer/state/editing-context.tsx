// SPDX-License-Identifier: Apache-2.0
import {createContext, useContext} from 'react';

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
}

const DesignerEditingContext = createContext<DesignerEditingContextValue>({});

export const DesignerEditingProvider = DesignerEditingContext.Provider;

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
  if (!originalFieldIdentifiers || originalFieldIdentifiers.size === 0) {
    return false;
  }
  if (!designerIdentifier) return false;
  return !originalFieldIdentifiers.has(designerIdentifier);
};
