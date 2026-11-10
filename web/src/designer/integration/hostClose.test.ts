// SPDX-License-Identifier: Apache-2.0

import {describe, expect, it, vi} from 'vitest';
import {closeDesignerHostOverlay} from './hostClose';

describe('closeDesignerHostOverlay', () => {
  it('closes without calling mutateAsyncWithToast when no file is passed', () => {
    const mutateAsyncWithToast = vi.fn();
    const close = vi.fn();
    closeDesignerHostOverlay(close, undefined);
    expect(close).toHaveBeenCalledTimes(1);
    expect(mutateAsyncWithToast).not.toHaveBeenCalled();
  });

  it('closes without calling mutateAsyncWithToast even when a file is present', () => {
    const mutateAsyncWithToast = vi.fn();
    const close = vi.fn();
    closeDesignerHostOverlay(close, new File(['{}'], 'notebook.json'));
    expect(close).toHaveBeenCalledTimes(1);
    expect(mutateAsyncWithToast).not.toHaveBeenCalled();
  });
});
