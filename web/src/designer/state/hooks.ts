// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @file Typed Redux hooks for the designer store (`AppState` + `DesignerDispatch`).
 */

import {TypedUseSelectorHook, useDispatch, useSelector} from 'react-redux';
import type {DesignerDispatch} from '../createDesignerStore';
import {AppState} from './initial';

/** Dispatch with correct typing for designer actions (use instead of raw `useDispatch`). */
export const useAppDispatch = () => useDispatch<DesignerDispatch>();

/** `useSelector` constrained to {@link AppState}. */
export const useAppSelector: TypedUseSelectorHook<AppState> = useSelector;
