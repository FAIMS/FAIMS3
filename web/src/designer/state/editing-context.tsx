import {createContext, useContext} from 'react';

/**
 * Facts about the survey being edited that the designer cannot derive from the
 * ui-specification itself. Supplied by the host app; empty by default so the
 * designer keeps working standalone (and for templates, which hold no records).
 */
export interface DesignerEditingContextValue {
  /** Records already collected for the survey. Undefined when not applicable. */
  existingRecordCount?: number;
}

const DesignerEditingContext = createContext<DesignerEditingContextValue>({});

export const DesignerEditingProvider = DesignerEditingContext.Provider;

export const useDesignerEditingContext = () =>
  useContext(DesignerEditingContext);

/** True when the survey being edited already holds records. */
export const useHasExistingRecords = (): boolean => {
  const {existingRecordCount} = useDesignerEditingContext();
  return (existingRecordCount ?? 0) > 0;
};
