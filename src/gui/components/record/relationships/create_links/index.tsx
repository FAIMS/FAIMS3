import React from 'react';
import {
  Button,
  Divider,
  Grid,
  Typography,
  ButtonProps,
  Collapse,
  ButtonGroup,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {styled} from '@mui/material/styles';

import {CreateRecordLink, AddNewRecordButton} from './create_record_link';
import LinkIcon from '@mui/icons-material/Link';
import {CreateRecordLinkProps} from '../types';
interface ExpandMoreProps extends ButtonProps {
  expand: boolean;
}

export const ExpandMoreButton = styled((props: ExpandMoreProps) => {
  const {expand, ...other} = props;
  return <Button {...other} />;
})(({theme, expand}) => ({
  '	.MuiButton-endIcon': {
    transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
    marginLeft: 'auto',
    transition: theme.transitions.create('transform', {
      duration: theme.transitions.duration.shortest,
    }),
  },
}));

interface CreateLinkComponentProps {
  field_label: string;
}

export default function CreateLinkComponent(
  props: CreateLinkComponentProps & CreateRecordLinkProps
) {
  const {field_label, ...others} = props;
  // is the new link functionality visible
  const [expanded, setExpanded] = React.useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  return (
    <React.Fragment>
      <Grid
        container
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        spacing={1}
      >
        <Grid item>
          <LinkIcon fontSize={'inherit'} sx={{mt: '3px'}} />
        </Grid>
        <Grid item xs={'auto'}>
          <Typography variant={'h6'}>Links from {field_label}</Typography>
        </Grid>
        <Grid item xs>
          <Divider />
        </Grid>
        <Grid item>
          <ButtonGroup variant={'outlined'} size={'medium'}>
            {props.relation_type === 'Child' && (
              <AddNewRecordButton
                is_enabled={props.is_enabled}
                create_route={props.create_route}
                text={'Add Child Record'}
              />
            )}
            <ExpandMoreButton
              disableElevation
              expand={expanded}
              onClick={handleExpandClick}
              aria-expanded={expanded}
              aria-label="show more"
              endIcon={<ExpandMoreIcon />}
              disabled={props.disabled}
            >
              Add Link
            </ExpandMoreButton>
          </ButtonGroup>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Collapse in={expanded} timeout="auto" unmountOnExit sx={{mt: 1}}>
            <CreateRecordLink {...others} />
          </Collapse>
        </Grid>
      </Grid>
    </React.Fragment>
  );
}
