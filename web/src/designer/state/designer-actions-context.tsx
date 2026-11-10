// SPDX-License-Identifier: Apache-2.0

import {createContext, useContext} from 'react';

/** Publish and close handlers shared across Design, Info, and Setup. */
export type DesignerActionsValue = {
  onPublish: () => void;
  onPublishAndClose: () => void;
  onCancelRequest: () => void;
  publishDisabled: boolean;
};

const DesignerActionsContext = createContext<DesignerActionsValue>({
  onPublish: () => {},
  onPublishAndClose: () => {},
  onCancelRequest: () => {},
  publishDisabled: true,
});

/** Access in-editor publish and close handlers from the notebook editor toolbar. */
export function useDesignerActions(): DesignerActionsValue {
  return useContext(DesignerActionsContext);
}

export const DesignerActionsProvider = DesignerActionsContext.Provider;
