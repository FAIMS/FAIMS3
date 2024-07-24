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

import { Suspense, useState } from "react";

import { Alert, Card } from "@mui/material";
import '@mdxeditor/editor/style.css';

// importing the editor and the plugin from their full paths
import { MDXEditor } from '@mdxeditor/editor/MDXEditor';
import { MDXEditorMethods, MdastImportVisitor, Separator, realmPlugin, system } from '@mdxeditor/editor';
import { toolbarPlugin } from '@mdxeditor/editor/plugins/toolbar';
import { headingsPlugin } from '@mdxeditor/editor/plugins/headings';
import { listsPlugin } from '@mdxeditor/editor/plugins/lists';
import { quotePlugin } from '@mdxeditor/editor/plugins/quote';
import { thematicBreakPlugin } from '@mdxeditor/editor/plugins/thematic-break';
import { markdownShortcutPlugin } from '@mdxeditor/editor/plugins/markdown-shortcut';
import { tablePlugin } from '@mdxeditor/editor/plugins/table';
import { diffSourcePlugin } from '@mdxeditor/editor/plugins/diff-source';
import { linkPlugin } from '@mdxeditor/editor/plugins/link';
import { imagePlugin } from '@mdxeditor/editor/plugins/image';

// importing the desired toolbar toggle components
import { UndoRedo } from '@mdxeditor/editor/plugins/toolbar/components/UndoRedo';
import { BoldItalicUnderlineToggles } from '@mdxeditor/editor/plugins/toolbar/components/BoldItalicUnderlineToggles';
import { BlockTypeSelect } from '@mdxeditor/editor/plugins/toolbar/components/BlockTypeSelect';
import { ListsToggle } from '@mdxeditor/editor/plugins/toolbar/components/ListsToggle';
import { InsertTable } from '@mdxeditor/editor/plugins/toolbar/components/InsertTable';
import { DiffSourceToggleWrapper } from '@mdxeditor/editor/plugins/toolbar/components/DiffSourceToggleWrapper';
import { InsertImage } from '@mdxeditor/editor/plugins/toolbar/components/InsertImage';


type Props = {
    initialMarkdown: string,
    editorRef: React.Ref<MDXEditorMethods> | undefined,
    handleChange: ((markdown: string) => void) | undefined,
};

export const MdxEditor = ({ initialMarkdown, editorRef, handleChange }: Props) => {

    const [errorMessage, setErrorMessage] = useState('');

    /*
       The following catchAll code is taken from and inspired by: 
       https://github.com/mdx-editor/editor/issues/202#issuecomment-1827182167 & 
       https://github.com/mdx-editor/editor/issues/95#issuecomment-1755320066 
    */
    const catchAllVisitor: MdastImportVisitor<any> = {
        testNode: () => true,
        visitNode: ({ mdastNode }) => {
            // deviating from the example shown in the second link,
            // for now, I'm simply showing an error message
            setErrorMessage(`Sorry, we currently do not support the markdown ${mdastNode?.type} option. 
                    What you have just written was automatically removed. Please continue carefully.`);
        }
    };

    const [catchAllPlugin] = realmPlugin({
        id: "catchAll",
        systemSpec: system(() => ({})),
        init: (realm) => {
            realm.pubKey("addImportVisitor", catchAllVisitor);
        }
    });

    const imageUploadHandler = (image: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result as string)
            }
            reader.readAsDataURL(image);
        })
    }


    return (
        <Suspense fallback={<div>Loading...</div>}>
            {errorMessage &&
                <Alert onClose={() => { setErrorMessage('') }} severity="error">
                    {errorMessage}
                </Alert>
            }
            <Card variant="outlined">
                <MDXEditor
                    className="image-dialog"
                    placeholder="Start typing..."
                    markdown={initialMarkdown}
                    plugins={[
                        headingsPlugin(),
                        listsPlugin(),
                        quotePlugin(),
                        thematicBreakPlugin(),
                        markdownShortcutPlugin(),
                        tablePlugin(),
                        diffSourcePlugin({ diffMarkdown: initialMarkdown }),
                        linkPlugin(),
                        imagePlugin({ imageUploadHandler }),
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
                            )
                        }),
                        catchAllPlugin(),
                    ]}
                    ref={editorRef}
                    onChange={handleChange}
                    contentEditableClassName="mdxEditor"
                />
            </Card>
        </Suspense>
    )
}