/*
 * Copyright 2021 Macquarie University
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
 * Filename: defaults.tsx
 * Description:
 *   TODO
 */
import BrokenImageIcon from '@material-ui/icons/BrokenImage';

export function getDefaultBuilderComponent() {
  return <p>This field has no configuration options.</p>;
}

export function getDefaultBuilderIcon() {
  return <BrokenImageIcon />;
}

export function getDefaultuiSpecProps(){
  return {namespace:'formik-material-ui',componentName:'TextField',type_return:'faims-core::String',validationSchema:[['yup.string'],],type:'text'};
}
