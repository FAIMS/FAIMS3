// SPDX-License-Identifier: Apache-2.0

/**
 * @file Shared undo/redo hook for designer chrome and related controls.
 */

import {useCallback} from 'react';
import {ActionCreators} from 'redux-undo';
import {useAppDispatch, useAppSelector} from './hooks';

type UndoRedoMessages = {
  nothingToUndo: string;
  nothingToRedo: string;
  undoComplete: string;
  redoComplete: string;
};

const defaultMessages: UndoRedoMessages = {
  nothingToUndo: 'Nothing to undo',
  nothingToRedo: 'Nothing to redo',
  undoComplete: 'Undo complete',
  redoComplete: 'Redo complete',
};

/**
 * Reuses existing redux-undo store history (`past/present/future`) and exposes
 * thin UI handlers. This does not implement a separate undo engine.
 */
export const useDesignerUndoRedo = (
  onMessage: (message: string) => void,
  messages: UndoRedoMessages = defaultMessages
) => {
  const dispatch = useAppDispatch();
  const undoableState = useAppSelector(state => state.notebook.uiSpec);

  const canUndo = undoableState.past.length > 0;
  const canRedo = undoableState.future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) {
      onMessage(messages.nothingToUndo);
      return;
    }
    dispatch(ActionCreators.undo());
    onMessage(messages.undoComplete);
  }, [
    canUndo,
    dispatch,
    messages.nothingToUndo,
    messages.undoComplete,
    onMessage,
  ]);

  const redo = useCallback(() => {
    if (!canRedo) {
      onMessage(messages.nothingToRedo);
      return;
    }
    dispatch(ActionCreators.redo());
    onMessage(messages.redoComplete);
  }, [
    canRedo,
    dispatch,
    messages.nothingToRedo,
    messages.redoComplete,
    onMessage,
  ]);

  return {canUndo, canRedo, undo, redo};
};
