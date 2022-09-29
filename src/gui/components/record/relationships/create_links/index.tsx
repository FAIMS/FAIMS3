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
import {LinkProps} from '../types';

import {CreateRecordLink, RelationshipType} from './create_record_link';
interface LinkedRecordProps {
  linked_records: Array<LinkProps> | null;
  relationships: Array<RelationshipType>;
}
interface ExpandMoreProps extends ButtonProps {
  expand: boolean;
}

const ExpandMoreButton = styled((props: ExpandMoreProps) => {
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
        <Grid item xs={'auto'}>
          <Typography variant={'h6'}>Links</Typography>
        </Grid>
        <Grid item xs>
          <Divider />
        </Grid>
        <Grid item>
          <ButtonGroup variant={'outlined'}>
            <Button>Create Child Record</Button>
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
            <CreateRecordLink relationship_types={props.relationship_types} />
          </Collapse>
        </Grid>
      </Grid>
    </React.Fragment>
  );
}
