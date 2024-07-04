import React from 'react';
import {Box, Chip, ChipProps} from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import HourglassTopOutlinedIcon from '@mui/icons-material/HourglassTopOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

// import {ProjectInformation} from 'faims3-datamodel';
interface ProjectStatusProps {
  status: string | undefined;
  // | 'local_draft'
  // | 'awaiting_approval'
  // | 'published'
  // | 'archived'
  // | 'deleted'
}
interface iconMappingProps {
  [key: string]: React.ReactElement;
}
interface colorMappingProps {
  [key: string]: ChipProps['color'];
}
const statusTypes = [
  'local_draft',
  'awaiting_approval',
  'published',
  'archived',
  'deleted',
];
export default function ProjectStatus(props: ProjectStatusProps) {
  const colorMapping: colorMappingProps = {
    local_draft: 'warning',
    awaiting_approval: 'default',
    published: 'primary',
    archived: 'info',
    deleted: 'error',
  };
  const iconMapping: iconMappingProps = {
    local_draft: <FolderOpenIcon />,
    awaiting_approval: <HourglassTopOutlinedIcon />,
    published: <TaskAltOutlinedIcon />,
    archived: <Inventory2OutlinedIcon />,
    deleted: <DeleteForeverIcon />,
  };
  return (
    <Box>
      <Chip
        color={
          props.status !== undefined ? colorMapping[props.status] : 'error'
        }
        icon={
          props.status !== undefined && statusTypes.includes(props.status) ? (
            iconMapping[props.status]
          ) : (
            <HelpOutlineIcon />
          )
        }
        label={
          props.status !== undefined
            ? props.status.split('_').join(' ')
            : 'undefined'
        }
        sx={{textTransform: 'capitalize'}}
        size={'small'}
      />
    </Box>
  );
}
