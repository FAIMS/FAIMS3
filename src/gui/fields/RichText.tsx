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
 * Filename: RichText.tsx
 * Description:
 *   A rich text field that will render markdown content.
 */

import MarkdownIt from 'markdown-it';

interface Props {
  label?: string;
  content: any;
}

export const RichTextField = ({content}: Props) => {
  // render the content Markdown to HTML
  const md = new MarkdownIt();
  const renderedContent = md.render(content);

  return <div dangerouslySetInnerHTML={{__html: renderedContent}} />;
};

// const uiSpec = {
//   'component-namespace': 'faims-custom',
//   'component-name': 'RichText',
//   'type-returned': 'faims-core::String',
//   'component-parameters': {
//     label: 'Unused',
//     content: '',
//   },
// };
