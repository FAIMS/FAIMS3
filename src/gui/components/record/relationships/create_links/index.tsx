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
import AddIcon from '@mui/icons-material/Add';
import {styled} from '@mui/material/styles';

import {CreateRecordLink, RelationshipType} from './create_record_link';
import LinkIcon from '@mui/icons-material/Link';
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
export default function CreateLinkComponent(props: {
  relationship_types: Array<RelationshipType>;
  record_hrid: string;
  record_type: string;
  field_label: string;
}) {
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
          <Typography variant={'h6'}>Links from {props.field_label}</Typography>
        </Grid>
        <Grid item xs>
          <Divider />
        </Grid>
        <Grid item>
          <ButtonGroup variant={'outlined'} size={'medium'}>
            <Button startIcon={<AddIcon />}>Add Child Record</Button>
            <ExpandMoreButton
              disableElevation
              expand={expanded}
              onClick={handleExpandClick}
              aria-expanded={expanded}
              aria-label="show more"
              endIcon={<ExpandMoreIcon />}
            >
              Add Link
            </ExpandMoreButton>
          </ButtonGroup>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Collapse in={expanded} timeout="auto" unmountOnExit sx={{mt: 1}}>
            <CreateRecordLink
              relationship_types={props.relationship_types}
              record_hrid={props.record_hrid}
              record_type={props.record_type}
              field_label={props.field_label}
            />
          </Collapse>
        </Grid>
      </Grid>
    </React.Fragment>
  );
}
