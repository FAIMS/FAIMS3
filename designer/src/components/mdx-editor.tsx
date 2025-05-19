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

import {Suspense, useState} from 'react';

import {Alert, Card} from '@mui/material';
import '@mdxeditor/editor/style.css';

// importing the editor and the plugin from their full paths
import {MDXEditor} from '@mdxeditor/editor';
import {
  MDXEditorMethods,
  MdastImportVisitor,
  Separator,
  realmPlugin,
} from '@mdxeditor/editor';
// If your version of @mdxeditor/editor exports toolbarPlugin from the main entry, use:
import {toolbarPlugin} from '@mdxeditor/editor';
// Otherwise, ensure you have the correct version installed or check the documentation for the right import path.
import {headingsPlugin} from '@mdxeditor/editor';
import {listsPlugin} from '@mdxeditor/editor';
import {thematicBreakPlugin} from '@mdxeditor/editor';
import {tablePlugin} from '@mdxeditor/editor/plugins/table';
import {diffSourcePlugin} from '@mdxeditor/editor';
import {imagePlugin} from '@mdxeditor/editor';

// importing the desired toolbar toggle components
import {UndoRedo} from '@mdxeditor/editor';
import {BoldItalicUnderlineToggles} from '@mdxeditor/editor';
import {BlockTypeSelect} from '@mdxeditor/editor';
import {ListsToggle} from '@mdxeditor/editor';
/* InsertTable import removed because the module does not exist */
import {DiffSourceToggleWrapper} from '@mdxeditor/editor';
import {InsertImage} from '@mdxeditor/editor';

type Props = {
  initialMarkdown: string;
  editorRef: React.Ref<MDXEditorMethods> | undefined;
  handleChange: ((markdown: string) => void) | undefined;
};

export const MdxEditor = ({
  initialMarkdown,
  editorRef,
  handleChange,
}: Props) => {
  const [errorMessage, setErrorMessage] = useState('');

  /*
       The following catchAll code is taken from and inspired by:
       https://github.com/mdx-editor/editor/issues/202#issuecomment-1827182167 &
       https://github.com/mdx-editor/editor/issues/95#issuecomment-1755320066
    */
  const catchAllVisitor: MdastImportVisitor<any> = {
    testNode: () => true,
    visitNode: ({mdastNode}) => {
      // deviating from the example shown in the second link,
      // for now, I'm simply showing an error message
      setErrorMessage(`Sorry, we currently do not support the markdown ${mdastNode?.type} option. 
                    What you have just written was automatically removed. Please continue carefully.`);
    },
  };

  const catchAllPlugin = realmPlugin({
    init: realm => {
      realm.pubKey('addImportVisitor', catchAllVisitor);
    },
  });

  const imageUploadHandler = (image: File): Promise<string> => {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.readAsDataURL(image);
    });
  };

  return (
    <Suspense fallback={<div>Loading...</div>}>
      {errorMessage && (
        <Alert
          onClose={() => {
            setErrorMessage('');
          }}
          severity="error"
        >
          {errorMessage}
        </Alert>
      )}
      <Card variant="outlined">
        <MDXEditor
          className="image-dialog"
          placeholder="Start typing..."
          markdown={initialMarkdown}
          plugins={[
            headingsPlugin(),
            headingsPlugin(),
            listsPlugin(),
            thematicBreakPlugin(),
            thematicBreakPlugin(),
            diffSourcePlugin({diffMarkdown: initialMarkdown}),
            imagePlugin({imageUploadHandler}),
            toolbarPlugin({
              toolbarContents: () => (
                <DiffSourceToggleWrapper>
                  <UndoRedo />
                  <Separator />
                  <BoldItalicUnderlineToggles />
                  <Separator />
                  <BlockTypeSelect />
                  <Separator />
                  <ListsToggle />
                  <Separator />
                  {/* <InsertTable /> removed because the module does not exist */}
                  <InsertImage />
                </DiffSourceToggleWrapper>
              ),
            }),
            catchAllPlugin(),
          ]}
          ref={editorRef}
          onChange={handleChange}
          contentEditableClassName="mdxEditor"
        />
      </Card>
    </Suspense>
  );
};
