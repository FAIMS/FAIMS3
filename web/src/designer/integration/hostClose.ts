// SPDX-License-Identifier: Apache-2.0

/**
 * @file Overlay close from Project / Template Actions. Publish is in-editor.
 */

/**
 * Close the designer overlay. Never PUTs: `mutateAsyncWithToast` is not
 * invoked here, even when a `File` is present. Confirmed publish already ran
 * inside the editor (or there was nothing to publish).
 */
export function closeDesignerHostOverlay(
  close: () => void,
  _file?: File
): void {
  void _file;
  close();
}
