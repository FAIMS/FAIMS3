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
 * @file Sandboxed MDX editor with a fixed allow-list of mdast node types.
 */

import {Suspense, useMemo, useRef, useState} from 'react';

import {Alert, Card} from '@mui/material';
// Editor styles imported here (not only from App) so they load in both the standalone
// designer shell and the embedded DesignerWidget.
import '@mdxeditor/editor/style.css';
import '../mdx-editor.css';

// Import all editor APIs from the package root to avoid brittle deep-import chunks.
import {
  MDXEditor,
  MDXEditorMethods,
  MdastImportVisitor,
  Separator,
  toolbarPlugin,
  headingsPlugin,
  listsPlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  tablePlugin,
  diffSourcePlugin,
  linkPlugin,
  imagePlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  InsertTable,
  DiffSourceToggleWrapper,
  InsertImage,
  realmPlugin,
  system,
} from '@mdxeditor/editor';

/*
 * Supported mdast node types — kept outside the component so the Set
 * reference is stable and the catchAllPlugin closure never changes.
 */
const SUPPORTED_NODE_TYPES = new Set([
  'root',
  'paragraph',
  'text',
  'strong',
  'emphasis',
  'underline',
  'inlineCode',
  'code',
  'break',
  'delete',
  'html',
  // headingsPlugin
  'heading',
  // listsPlugin
  'list',
  'listItem',
  // thematicBreakPlugin
  'thematicBreak',
  // tablePlugin
  'table',
  'tableRow',
  'tableCell',
  // linkPlugin
  'link',
  'linkReference',
  'definition',
  // imagePlugin
  'image',
  'imageReference',
]);

type Props = {
  initialMarkdown: string;
  editorRef: React.Ref<MDXEditorMethods> | undefined;
  handleChange: ((markdown: string) => void) | undefined;
};

/** Constrained MDX/Markdown editor for long-form metadata (toolbar + allowed mdast nodes). */
export const MdxEditor = ({
  initialMarkdown,
  editorRef,
  handleChange,
}: Props) => {
  const [errorMessage, setErrorMessage] = useState('');

  /*
   * Freeze the initial markdown so MDXEditor only sees it once on mount.
   *
   * Root cause of "Point.getNode: node not found":
   *   MDXEditor's RealmPluginInitializer runs applyParamsToSystem() whenever
   *   the `plugins` array reference changes. corePlugin.applyParamsToSystem()
   *   calls realm.pubKey("initialMarkdown", ...) which re-imports the full
   *   markdown into Lexical, replacing all nodes and invalidating the current
   *   selection. Because the plugins array was recreated on every render
   *   (fresh plugin() calls), this happened on every keystroke.
   *
   * Fix: useMemo([], []) freezes the plugins array at mount time so
   * applyParamsToSystem is never called again after the first render.
   * The stable initialMarkdownRef is passed as the diffMarkdown baseline.
   */
  const initialMarkdownRef = useRef(initialMarkdown);

  /*
   * The following catchAll code is taken from and inspired by:
   * https://github.com/mdx-editor/editor/issues/202#issuecomment-1827182167 &
   * https://github.com/mdx-editor/editor/issues/95#issuecomment-1755320066
   */
  const plugins = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const catchAllVisitor: MdastImportVisitor<any> = {
      testNode: (node: {type: string}) => !SUPPORTED_NODE_TYPES.has(node.type),
      visitNode: ({mdastNode}) => {
        setErrorMessage(
          'Sorry, we currently do not support the markdown ' +
            mdastNode?.type +
            ' option. ' +
            'What you have just written was automatically removed. Please continue carefully.'
        );
      },
    };

    const [catchAllPlugin] = realmPlugin({
      id: 'catchAll',
      systemSpec: system(() => ({})),
      init: realm => {
        realm.pubKey('addImportVisitor', catchAllVisitor);
      },
    });

    const imageUploadHandler = (image: File): Promise<string> =>
      new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(image);
      });

    return [
      headingsPlugin(),
      listsPlugin(),
      thematicBreakPlugin(),
      markdownShortcutPlugin(),
      tablePlugin(),
      diffSourcePlugin({diffMarkdown: initialMarkdownRef.current}),
      linkPlugin(),
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
            <InsertTable />
            <Separator />
            <InsertImage />
          </DiffSourceToggleWrapper>
        ),
      }),
      catchAllPlugin(),
    ];
  }, []); // intentionally empty — plugins must never be recreated after mount

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
          markdown={initialMarkdownRef.current}
          plugins={plugins}
          ref={editorRef}
          onChange={handleChange}
          contentEditableClassName="mdxEditor"
        />
      </Card>
    </Suspense>
  );
};
