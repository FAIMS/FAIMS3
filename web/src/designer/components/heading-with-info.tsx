import InfoIcon from '@mui/icons-material/Info';
import {Tooltip, Typography} from '@mui/material';
import Box from '@mui/material/Box';
import {
  designerHeadingRowSx,
  designerHeadingTextSx,
  designerInfoIconSx,
} from './designer-style';

type HeadingWithInfoProps = {
  title: string;
  tooltip: string;
  variant?: 'h2' | 'subtitle1' | 'body1' | 'body2';
  titleSx?: Record<string, unknown>;
  containerSx?: Record<string, unknown>;
  iconSx?: Record<string, unknown>;
};

export const HeadingWithInfo = ({
  title,
  tooltip,
  variant = 'h2',
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
