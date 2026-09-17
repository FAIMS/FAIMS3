// SPDX-License-Identifier: Apache-2.0

/*
/**
 * RichTextField Component
 * Safely injects markdown content directly into HTML - see DomPurifier.ts
 */

import {BaseFieldParametersSchema} from '@faims3/data-model';
import React from 'react';
import {z} from 'zod';
import {RichTextContent} from '../../../components/RichText';
import {FullFieldProps} from '../../../formModule/types';
import {DefaultRenderer} from '../../../rendering/fields/fallback';
import {FieldInfo} from '../../types';

export const RichTextPropsSchema = BaseFieldParametersSchema.extend({
  /** Markdown body rendered by this display field (may include safe HTML). */
  content: z.string().optional(),
});
export type RichTextProps = z.infer<typeof RichTextPropsSchema>;

interface Props extends FullFieldProps {
  /** The markdown content to be rendered. May include safe HTML tags. */
  content: string;
}

export const RichTextField: React.FC<Props> = ({content}) => {
  return <RichTextContent content={content} />;
};

export const richTextFieldSpec: FieldInfo<Props> = {
  namespace: 'faims-custom',
  name: 'RichText',
  returns: null,
  component: RichTextField,
  fieldPropsSchema: RichTextPropsSchema,
  //validator: () => true,
  // TODO improve this
  view: {component: DefaultRenderer, config: {}},
  excludeFromParentDisplay: true,
};
