import React, {useEffect, useState} from 'react';
import {DesignerWidget} from './DesignerWidget';
import type {NotebookWithHistory} from './state/initial';

interface DesignerDialogProps {
  open: boolean;
  notebook?: NotebookWithHistory;
  onClose: (file?: File) => void;
  animationDuration?: number;
  animationScale?: number;
}

export function DesignerDialog({
  open,
  notebook,
  onClose,
  animationDuration = 300,
  animationScale = 0.95,
}: DesignerDialogProps) {
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);

  // Mount / unmount logic with animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      const tid = window.setTimeout(() => setAnimateIn(true), 50);
      return () => window.clearTimeout(tid);
    } else if (mounted) {
      setAnimateOut(true);
      setAnimateIn(false);
      const tid = window.setTimeout(() => {
        setMounted(false);
        setAnimateOut(false);
      }, animationDuration);
      return () => window.clearTimeout(tid);
    }
  }, [open, animationDuration, mounted]);

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

  if (!mounted || !notebook) return null;

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
        <DesignerWidget notebook={notebook} onClose={handleWidgetClose} />
      </div>
    </div>
  );
}
