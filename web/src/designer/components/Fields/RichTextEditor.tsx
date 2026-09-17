// SPDX-License-Identifier: Apache-2.0

import {config} from '@/constants';
import {Grid, FormHelperText} from '@mui/material';
import {useAppSelector, useAppDispatch} from '../../state/hooks';
import {useRef} from 'react';
import {MDXEditorMethods} from '@mdxeditor/editor';
import {RichTextProps} from '@faims3/forms';
import {FieldType} from '../../state/initial';
import {MdxEditor} from '../mdx-editor';
import {fieldUpdated} from '../../store/slices/uiSpec';
import {BaseFieldEditor} from './BaseFieldEditor';

/** RichText display field: MDX body stored in `component-parameters.content`. */
export const RichTextEditor = ({fieldName}: {fieldName: string}) => {
  const field = useAppSelector(
    state => state.notebook.uiSpec.present.fields[fieldName]
  );
  const dispatch = useAppDispatch();

  const params = field['component-parameters'] as RichTextProps;
  const initContent = params.content || '';
  const ref = useRef<MDXEditorMethods>(null);

  const updateField = (fieldName: string, newField: FieldType) => {
    dispatch(fieldUpdated({fieldName, newField}));
  };

  const state = {
    content: params.content || '',
  };

  type newState = {
    content: string;
  };

  const updateFieldFromState = (newState: newState) => {
    const newField = JSON.parse(JSON.stringify(field)) as FieldType; // deep copy
    const newParams = newField['component-parameters'] as RichTextProps;
    newParams.content = newState.content;
    updateField(fieldName, newField);
  };

  const updateProperty = (prop: string, value: string | undefined) => {
    const newState = {...state, [prop]: value};
    updateFieldFromState(newState);
  };

  return (
    <BaseFieldEditor
      fieldName={fieldName}
      showHelperText={false}
      showExtraConfig={false}
    >
      <Grid container size={{xs: 12, sm: 8}} sx={{m: 'auto'}}>
        <Grid size={12}>
          <MdxEditor
            initialMarkdown={initContent}
            editorRef={ref}
            handleChange={() =>
              updateProperty('content', ref.current?.getMarkdown())
            }
          />
          <FormHelperText>
            {`Use this editor to add rich text to your ${config.notebookName}.`}
          </FormHelperText>
        </Grid>
      </Grid>
    </BaseFieldEditor>
  );
};
