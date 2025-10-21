import {Typography} from '@mui/material';
import React from 'react';

/** Used to provide a consistent simple styling for primitives */
const PrimitiveStylingWrapper: React.FC<{
  children: React.ReactNode;
}> = props => {
  return <Typography variant="body1">{props.children}</Typography>;
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
