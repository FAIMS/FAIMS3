import React from 'react';
import {Box, Collapse, Button, Grid} from '@mui/material';
import {grey} from '@mui/material/colors';
import {styled} from '@mui/material/styles';
import IconButton, {IconButtonProps} from '@mui/material/IconButton';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
interface MetaDataJsonComponentProps {
  value: any;
}
interface ExpandMoreProps extends IconButtonProps {
  expand: boolean;
}

const ExpandMore = styled((props: ExpandMoreProps) => {
  const {expand, ...other} = props;
  console.log(expand); // need to fix this TBD
  return <IconButton {...other} />;
})(({theme, expand}) => ({
  transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
  marginLeft: 'auto',
  transition: theme.transitions.create('transform', {
    duration: theme.transitions.duration.shortest,
  }),
}));
export default function MetaDataJsonComponent(
  props: MetaDataJsonComponentProps
) {
  const [expanded, setExpanded] = React.useState(false);
  const handleExpandClick = () => {
    setExpanded(!expanded);
  };
  return (
    <React.Fragment>
      <Grid
        container
        direction="row"
        justifyContent="flex-start"
        alignItems="center"
        spacing={2}
      >
        <Grid item xs={6}>
          <Button
            onClick={() =>
              navigator.clipboard.writeText(JSON.stringify(props.value))
            }
            startIcon={<ContentCopyIcon />}
            variant={'outlined'}
          >
            Copy to Clipboard
          </Button>
        </Grid>
        <Grid item xs={6}>
          <ExpandMore
            expand={expanded}
            onClick={handleExpandClick}
            aria-expanded={expanded}
            aria-label="show more"
            style={{float: 'right'}}
          >
            <ExpandMoreIcon />
          </ExpandMore>
        </Grid>
      </Grid>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box
          bgcolor={grey[100]}
          px={2}
          style={{overflow: 'scroll', width: '100%', maxHeight: '100vh'}}
        >
          <pre>{JSON.stringify(props.value, null, 2)}</pre>
        </Box>
      </Collapse>
    </React.Fragment>
  );
}
