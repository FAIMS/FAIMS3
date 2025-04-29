import React from 'react';
import {
  Button,
  Grid,
  Typography,
  ButtonProps,
  Collapse,
  ButtonGroup,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {styled} from '@mui/material/styles';

import {CreateRecordLink, AddNewRecordButton} from './create_record_link';
import {CreateRecordLinkProps} from '../types';
interface ExpandMoreProps extends ButtonProps {
  expand: boolean;
}

export const ExpandMoreButton = styled((props: ExpandMoreProps) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

interface CreateLinkComponentProps extends CreateRecordLinkProps {
  field_label: string;
  allowLinkToExisting?: boolean;
}

export default function CreateLinkComponent(
  props: CreateLinkComponentProps & CreateRecordLinkProps
) {
  const {field_label} = props;
  // is the new link functionality visible
  const [expanded, setExpanded] = React.useState(false);

  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  return (
    <React.Fragment>
      <Grid
        container
        direction="column"
        justifyContent="space-between"
        alignItems="left"
        spacing={1}
      >
        <Grid item xs={'auto'}>
          <Typography variant={'h3'}>{field_label}</Typography>
        </Grid>

        <Grid item>
          <ButtonGroup variant={'outlined'} size={'medium'}>
            {props.relation_type === 'Child' && props.disabled !== true && (
              <AddNewRecordButton
                is_enabled={props.form.isSubmitting ? false : props.is_enabled}
                serverId={props.serverId}
                pathname={props.pathname}
                state={props.state}
                text={`Add New ${props.related_type}`}
                handleSubmit={props.handleSubmit}
                project_id={props.project_id}
                save_new_record={props.save_new_record}
                handleError={props.handleCreateError}
              />
            )}
            {props.allowLinkToExisting !== false && (
              <ExpandMoreButton
                disableElevation
                expand={expanded}
                onClick={handleExpandClick}
                aria-expanded={expanded}
                aria-label="show more"
                endIcon={<ExpandMoreIcon />}
                disabled={props.form.isSubmitting ? true : props.disabled}
              >
                {props.relation_type === 'Linked' ? (
                  <span>Add a link to a {props.related_type_label}</span>
                ) : (
                  <span>
                    Add a link to an existing {props.related_type_label}
                  </span>
                )}
              </ExpandMoreButton>
            )}
          </ButtonGroup>
        </Grid>
      </Grid>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          {props.allowLinkToExisting !== false && (
            <Collapse in={expanded} timeout="auto" unmountOnExit sx={{mt: 1}}>
              <CreateRecordLink {...props} />
            </Collapse>
          )}
        </Grid>
      </Grid>
    </React.Fragment>
  );
}
