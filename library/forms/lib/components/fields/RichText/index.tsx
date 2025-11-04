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

/**
 * RichTextField Component
 *
 * Safely injects markdown content directly into HTML - see DomPurifier.ts
 */

import React from 'react';
import {FieldInfo} from '../../../types';
import {contentToSanitizedHtml} from './DomPurifier';

interface Props {
  /** The markdown content to be rendered. May include safe HTML tags. */
  content: string;
}

export const RichTextField: React.FC<Props> = ({content}) => {
  if (!content?.trim()) {
    // Return nothing if content is empty or whitespace
    return null;
  }

  return (
    <div dangerouslySetInnerHTML={{__html: contentToSanitizedHtml(content)}} />
  );
};

export const richTextFieldSpec: FieldInfo = {
  namespace: 'faims-custom',
  name: 'RichText',
  returns: null,
  component: RichTextField,
  //validator: () => true,
};
