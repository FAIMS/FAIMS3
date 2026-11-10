// SPDX-License-Identifier: Apache-2.0

import {createContext, useContext} from 'react';

/** Publish / close handlers shared across Design, Info, and Setup. */
export type DesignerChromeValue = {
  onPublish: () => void;
  onPublishAndClose: () => void;
  onCancelRequest: () => void;
  publishDisabled: boolean;
};

const DesignerChromeContext = createContext<DesignerChromeValue>({
  onPublish: () => {},
  onPublishAndClose: () => {},
  onCancelRequest: () => {},
  publishDisabled: true,
});

/** Access in-editor publish controls from the notebook editor chrome. */
export function useDesignerChrome(): DesignerChromeValue {
  return useContext(DesignerChromeContext);
}

export const DesignerChromeProvider = DesignerChromeContext.Provider;
