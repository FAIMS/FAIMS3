import InfoIcon from '@mui/icons-material/Info';
import {Theme, Tooltip, Typography} from '@mui/material';
import Box from '@mui/material/Box';
import {SystemStyleObject} from '@mui/system';
import {
  designerHeadingRowSx,
  designerHeadingTextSx,
  designerInfoIconSx,
} from './designer-style';

type HeadingWithInfoProps = {
  title: string;
  tooltip: string;
  variant?: 'h2' | 'subtitle1' | 'body1' | 'body2';
  titleSx?: SystemStyleObject<Theme>;
  containerSx?: SystemStyleObject<Theme>;
  iconSx?: SystemStyleObject<Theme>;
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
        ...(designerHeadingRowSx as SystemStyleObject<Theme>),
        ...(containerSx ?? {}),
      }}
    >
      <Typography
        variant={variant}
        sx={{
          ...(designerHeadingTextSx as SystemStyleObject<Theme>),
          ...(titleSx ?? {}),
        }}
      >
        {title}
      </Typography>
      <Tooltip title={tooltip}>
        <InfoIcon
          sx={{
            ...(designerInfoIconSx as SystemStyleObject<Theme>),
            ...(iconSx ?? {}),
          }}
        />
      </Tooltip>
    </Box>
  );
};
