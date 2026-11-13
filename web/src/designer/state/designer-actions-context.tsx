// SPDX-License-Identifier: Apache-2.0

import {createContext, useContext} from 'react';
import type {DesignerDraftStatus} from '../integration/useDesignerDraftSession';

/** Publish, close, and draft-status values shared across Design, Info, and Setup. */
export type DesignerActionsValue = {
  onPublish: () => void;
  publishDisabled: boolean;
  draftStatus: DesignerDraftStatus;
  draftErrorMessage?: string;
};

const DesignerActionsContext = createContext<DesignerActionsValue>({
  onPublish: () => {},
  publishDisabled: true,
  draftStatus: 'idle',
});

/** Access in-editor publish, close, and draft-status values from the notebook editor toolbar. */
export function useDesignerActions(): DesignerActionsValue {
  return useContext(DesignerActionsContext);
}

export const DesignerActionsProvider = DesignerActionsContext.Provider;
