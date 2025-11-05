import {Typography} from '@mui/material';
import React from 'react';
import {DataViewFieldRender} from '../../../types';

/** Used to provide a consistent simple styling for primitives */
const PrimitiveStylingWrapper: React.FC<{
  children: React.ReactNode;
}> = props => {
  return <Typography variant="body1">{props.children}</Typography>;
};

/** Used to provide a consistent styling for empty/fallback primitives */
const EmptyStylingWrapper: React.FC<{text: string}> = props => {
  return (
    <Typography variant="body1" fontStyle={'italic'} color={'GrayText'}>
      {props.text}
    </Typography>
  );
};

export const TextWrapper: React.FC<{content: string}> = props => {
  return <PrimitiveStylingWrapper>{props.content}</PrimitiveStylingWrapper>;
};

export const NumberWrapper: React.FC<{content: number}> = props => {
  return <PrimitiveStylingWrapper>{props.content}</PrimitiveStylingWrapper>;
};

export const ListWrapper: React.FC<{content: string[]}> = props => {
  return (
    <ul>
      {props.content.map((item, index) => (
        <li key={index}>
          <PrimitiveStylingWrapper>{item}</PrimitiveStylingWrapper>
        </li>
      ))}
    </ul>
  );
};

export const EmptyResponsePlaceholder: React.FC = () => {
  return <EmptyStylingWrapper text={'No response provided'} />;
};

/** A render function which tries to interpret the data as a string */
export const StringTypeWrapper: DataViewFieldRender = props => {
  let content = 'Invalid';
  if (typeof props.value === 'string') {
    content = props.value as string;
  }
  return <TextWrapper content={content}></TextWrapper>;
};
