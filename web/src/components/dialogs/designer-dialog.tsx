import React, {useEffect, useState} from 'react';
import {DesignerWidget} from '../../designer/DesignerWidget';
import type {NotebookWithHistory} from '../../designer/state/initial';

interface DesignerDialogProps {
  open: boolean;
  notebook?: NotebookWithHistory;
  /** Survey/template display name for the exported JSON filename. */
  exportBaseName?: string;
  onClose: (file?: File) => void;
  animationDuration?: number;
  animationScale?: number;
}

export function DesignerDialog({
  open,
  notebook,
  exportBaseName,
  onClose,
  animationDuration = 300,
  animationScale = 0.95,
}: DesignerDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);
  const [sessionNotebook, setSessionNotebook] = useState<
    NotebookWithHistory | undefined
  >(undefined);

  // Mount / unmount logic with animation
  useEffect(() => {
    if (open) {
      setSessionNotebook(notebook);
      setMounted(true);
      const tid = window.setTimeout(() => setAnimateIn(true), 50);
      return () => window.clearTimeout(tid);
    } else if (mounted) {
      setAnimateOut(true);
      setAnimateIn(false);
      const tid = window.setTimeout(() => {
        setMounted(false);
        setAnimateOut(false);
        setSessionNotebook(undefined);
      }, animationDuration);
      return () => window.clearTimeout(tid);
    }
  }, [open, animationDuration, mounted, notebook]);

  // Lock body scroll while the designer dialog is open so the background page doesn't scroll through
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mounted]);

  // Warn on tab close/refresh while editing
  useEffect(() => {
    if (!mounted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Required for Chrome to show the prompt
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
          onClose={handleWidgetClose}
        />
      </div>
    </div>
  );
}
