// SPDX-License-Identifier: Apache-2.0
import React, {useEffect, useState} from 'react';
import {DesignerWidget} from '../../designer/DesignerWidget';
import type {DesignerResourceKind} from '../../designer/integration/draftStorage';
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
  publishNotebook: (file: File) => Promise<unknown>;
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
}: DesignerDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);
  const [sessionNotebook, setSessionNotebook] = useState<
    NotebookWithHistory | undefined
  >(undefined);

  // Open: capture notebook once, mount, animate in. The functional updater
  // makes the snapshot idempotent — once `sessionNotebook` is set, later
  // upstream refetches (React Query refetchOnWindowFocus, polling) cannot
  // overwrite a restored or in-session draft. The session is only cleared
  // on close.
  useEffect(() => {
    if (!open) return;
    setSessionNotebook(prev => prev ?? notebook);
    setMounted(true);
    if (animateIn) return;
    const tid = window.setTimeout(() => setAnimateIn(true), 50);
    return () => window.clearTimeout(tid);
  }, [open, notebook, animateIn]);

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

  if (!mounted || !sessionNotebook) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20"
      style={{
        opacity: animateIn && !animateOut ? 1 : 0,
        transition: `opacity ${animationDuration}ms ease`,
        pointerEvents: animateOut ? 'none' : 'auto',
      }}
    >
      <div
        className="bg-white w-[95vw] h-[95vh] rounded-lg overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()}
        style={{
          opacity: animateIn && !animateOut ? 1 : 0,
          transform:
            animateIn && !animateOut ? 'scale(1)' : `scale(${animationScale})`,
          transition: `opacity ${animationDuration}ms ease, transform ${animationDuration}ms ease`,
        }}
      >
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
        />
      </div>
    </div>
  );
}
