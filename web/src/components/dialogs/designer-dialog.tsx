// SPDX-License-Identifier: Apache-2.0
import React, {useEffect, useRef, useState} from 'react';
import {Spinner} from '@/components/ui/spinner';
import {DesignerWidget} from '../../designer/DesignerWidget';
import type {DesignerResourceKind} from '../../designer/integration/draftStorage';
import type {DesignerLiveDesignSnapshot} from '../../designer/integration/notebookAdapters';
import type {
  DesignerDocumentMode,
  NotebookWithHistory,
} from '../../designer/state/initial';

interface DesignerDialogProps {
  open: boolean;
  notebook?: NotebookWithHistory;
  /** Whether the designer session edits a notebook or a template. */
  designerMode?: DesignerDocumentMode;
  /** Survey/template display name for the exported JSON filename. */
  exportBaseName?: string;
  /**
   * Records already collected for the survey. Omit for templates.
   * Forwarded into the designer so field delete can warn about stored data.
   */
  existingRecordCount?: number;
  /** Overlay close. Publish is in-editor; a missing file must not PUT. */
  onClose: (file?: File) => void;
  animationDuration?: number;
  animationScale?: number;
  /** Signed-in user id (`user.user.id`) for origin-private draft keys. */
  userId: string;
  resourceKind: DesignerResourceKind;
  resourceId: string;
  /** Host save mutation; designer calls this only on confirmed publish. */
  publishNotebook: (
    file: File,
    options?: {ifMatch?: string}
  ) => Promise<unknown>;
  /**
   * Cached `uiSpecProperties.hash` while the live GET is in flight. Replaced
   * by {@link refreshLiveDesign} before the overlay session is pinned.
   */
  liveUiSpecHash?: string;
  /**
   * Fetch the current survey/template source before pinning the overlay.
   * Called once when the overlay opens. Cached props are used if this fails.
   */
  refreshLiveDesign?: () => Promise<DesignerLiveDesignSnapshot | void>;
}

export function DesignerDialog({
  open,
  notebook,
  designerMode,
  exportBaseName,
  existingRecordCount,
  onClose,
  animationDuration = 300,
  animationScale = 0.95,
  userId,
  resourceKind,
  resourceId,
  publishNotebook,
  liveUiSpecHash,
  refreshLiveDesign,
}: DesignerDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);
  const [sessionNotebook, setSessionNotebook] = useState<
    NotebookWithHistory | undefined
  >(undefined);
  const [sessionLiveHash, setSessionLiveHash] = useState<string | undefined>();
  const latestPropsRef = useRef({
    notebook,
    liveUiSpecHash,
    refreshLiveDesign,
  });
  latestPropsRef.current = {notebook, liveUiSpecHash, refreshLiveDesign};

  // Open: refetch the live source once, then pin notebook + hash for the
  // session. Later React Query refetches must not replace a restored draft.
  // Reopen (including during the close animation) must reset exit state and
  // drop the previous pin so a new GET can replace it.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setMounted(true);
    setAnimateOut(false);
    setAnimateIn(false);
    setSessionNotebook(undefined);
    setSessionLiveHash(undefined);
    const animateTid = window.setTimeout(() => setAnimateIn(true), 50);

    const pinLiveDesign = async () => {
      const {
        notebook: cachedNotebook,
        liveUiSpecHash: cachedHash,
        refreshLiveDesign: refresh,
      } = latestPropsRef.current;
      let nextNotebook = cachedNotebook;
      let nextHash = cachedHash;
      if (refresh) {
        try {
          const fresh = await refresh();
          if (fresh?.notebook) {
            nextNotebook = fresh.notebook;
          }
          if (fresh?.liveUiSpecHash) {
            nextHash = fresh.liveUiSpecHash;
          }
        } catch {
          // Keep the cached snapshot so a failed GET cannot block the editor.
        }
      }
      if (cancelled) return;
      setSessionNotebook(nextNotebook);
      setSessionLiveHash(nextHash);
    };

    void pinLiveDesign();
    return () => {
      cancelled = true;
      window.clearTimeout(animateTid);
    };
  }, [open]);

  // When the host does not refetch, pin the notebook as soon as it arrives.
  useEffect(() => {
    if (!open || refreshLiveDesign) return;
    setSessionNotebook(prev => prev ?? notebook);
    setSessionLiveHash(prev => prev ?? liveUiSpecHash);
  }, [open, notebook, liveUiSpecHash, refreshLiveDesign]);

  // Close: animate out, then unmount and clear the snapshot so the next
  // open starts fresh.
  useEffect(() => {
    if (open || !mounted) return;
    setAnimateOut(true);
    setAnimateIn(false);
    const tid = window.setTimeout(() => {
      setMounted(false);
      setAnimateOut(false);
      setSessionNotebook(undefined);
      setSessionLiveHash(undefined);
    }, animationDuration);
    return () => window.clearTimeout(tid);
  }, [open, mounted, animationDuration]);

  // Lock body scroll while the designer dialog is open so the background page doesn't scroll through
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  const handleWidgetClose = (file?: File) => {
    onClose(file);
  };

  if (!mounted) return null;

  const overlayVisible = animateIn && !animateOut;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20"
      data-testid="web-designer-dialog-overlay"
      data-visible={overlayVisible ? 'true' : 'false'}
      style={{
        opacity: overlayVisible ? 1 : 0,
        transition: `opacity ${animationDuration}ms ease`,
        pointerEvents: animateOut ? 'none' : 'auto',
      }}
    >
      <div
        className="bg-white w-[95vw] h-[95vh] rounded-lg overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()}
        style={{
          opacity: overlayVisible ? 1 : 0,
          transform: overlayVisible ? 'scale(1)' : `scale(${animationScale})`,
          transition: `opacity ${animationDuration}ms ease, transform ${animationDuration}ms ease`,
        }}
      >
        {sessionNotebook ? (
          <DesignerWidget
            notebook={sessionNotebook}
            exportBaseName={exportBaseName}
            existingRecordCount={existingRecordCount}
            onClose={handleWidgetClose}
            designerMode={designerMode}
            userId={userId}
            resourceKind={resourceKind}
            resourceId={resourceId}
            publishNotebook={publishNotebook}
            liveUiSpecHash={sessionLiveHash}
            refreshLiveDesign={refreshLiveDesign}
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-3"
            data-testid="web-designer-live-source-loading"
          >
            <Spinner className="h-8 w-8" />
            <p className="text-sm text-muted-foreground">
              Loading latest design…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
