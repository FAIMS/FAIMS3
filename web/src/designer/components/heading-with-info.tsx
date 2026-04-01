import InfoIcon from '@mui/icons-material/Info';
import {SxProps, Theme, Tooltip, Typography} from '@mui/material';
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
  titleSx?: SxProps<Theme>;
  containerSx?: SxProps<Theme>;
  iconSx?: SxProps<Theme>;
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
    <Box sx={{...designerHeadingRowSx, ...containerSx}}>
      <Typography variant={variant} sx={{...designerHeadingTextSx, ...titleSx}}>
        {title}
      </Typography>
      <Tooltip title={tooltip}>
        <InfoIcon sx={{...designerInfoIconSx, ...iconSx}} />
      </Tooltip>
    </Box>
  );
};
