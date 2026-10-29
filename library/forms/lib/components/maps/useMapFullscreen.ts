// SPDX-License-Identifier: Apache-2.0

import {useCallback, useEffect, useState} from 'react';

/**
 * Lightbox-style full-screen for an already-mounted map.
 *
 * Expands the existing container rather than remounting the OpenLayers map,
 * so layers, view, and GPS state stay put. Escape and a body scroll lock
 * apply only while open.
 */
export function useMapFullscreen(enabled: boolean) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setIsFullscreen(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !isFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    if (!enabled) {
      return;
    }
    setIsFullscreen(open => !open);
  }, [enabled]);

  return {isFullscreen, toggleFullscreen};
}
