/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: helpers.ts
 * Description:
 *   TODO
 */
/**
 * Given a list of values, returns the first from the list that isn't null/undefined
 * This is to be used instead of list[0] || list[1] || list[2]
 * in the case that list can contain the number 0
 *
 * @param list List of undefined, nulls, or anything else
 * @returns Always returns null or a defined value, this never returns undefined.
 */
export function firstDefinedFromList<T>(
  list: NonNullable<T>[]
): NonNullable<T> | null {
  if (list.length === 0) {
    return null;
  } else if (list[0] === undefined || list[0] === null) {
    return firstDefinedFromList(list.slice(1));
  } else {
    return list[0];
  }
}
