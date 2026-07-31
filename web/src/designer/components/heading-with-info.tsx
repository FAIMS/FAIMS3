import InfoIcon from '@mui/icons-material/Info';
import {Tooltip, Typography} from '@mui/material';
import Box from '@mui/material/Box';
import type {ReactNode} from 'react';
import {
  designerHeadingRowSx,
  designerHeadingTextSx,
  designerInfoIconSx,
} from './designer-style';

type HeadingWithInfoProps = {
  title: string;
  tooltip: ReactNode;
  variant?: 'h2' | 'h4' | 'subtitle1' | 'body1' | 'body2';
  titleSx?: Record<string, unknown>;
  containerSx?: Record<string, unknown>;
  iconSx?: Record<string, unknown>;
};

export const HeadingWithInfo = ({
  title,
  tooltip,
  variant = 'h4',
  titleSx,
  containerSx,
  iconSx,
}: HeadingWithInfoProps) => {
  return (
    <Box
      sx={{
        ...(designerHeadingRowSx as Record<string, unknown>),
        ...(containerSx ?? {}),
      }}
    >
      <Typography
        variant={variant}
        sx={{
          ...(designerHeadingTextSx as Record<string, unknown>),
          ...(titleSx ?? {}),
        }}
      >
        {title}
      </Typography>
      <Tooltip title={tooltip}>
        <InfoIcon
          sx={{
            ...(designerInfoIconSx as Record<string, unknown>),
            ...(iconSx ?? {}),
          }}
        />
      </Tooltip>
    </Box>
  );
};
