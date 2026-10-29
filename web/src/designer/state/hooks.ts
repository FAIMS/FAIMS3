// SPDX-License-Identifier: Apache-2.0

/**
 * @file Typed Redux hooks for the designer store (`AppState` + `DesignerDispatch`).
 */

import {
  TypedUseSelectorHook,
  useDispatch,
  useSelector,
  useStore,
} from 'react-redux';
import type {DesignerDispatch, DesignerStore} from '../createDesignerStore';
import {AppState} from './initial';

/** Dispatch with correct typing for designer actions (use instead of raw `useDispatch`). */
export const useAppDispatch = () => useDispatch<DesignerDispatch>();

/** `useSelector` constrained to {@link AppState}. */
export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;

/** Designer store, for reading state synchronously right after a dispatch. */
export const useAppStore = () => useStore<AppState>() as DesignerStore;
