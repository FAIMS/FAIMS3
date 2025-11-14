import {
  Box,
  Checkbox,
  Collapse,
  FormControlLabel,
  IconButton,
  Paper,
  TextField,
} from '@mui/material';
import {grey} from '@mui/material/colors';
import NoteIcon from '@mui/icons-material/Note';
import {useState} from 'react';
import {FormAnnotation} from '@faims3/data-model';
import {FaimsFormFieldState, FieldSpecificationMeta} from './types';

type FieldAnnotationProps = {
  config: FieldSpecificationMeta;
  state: FaimsFormFieldState;
  setFieldAnnotation: (value: FormAnnotation) => void;
};

export const FieldAnnotation = (props: FieldAnnotationProps) => {
  const [expanded, setExpanded] = useState(false);
  const handleExpandClick = () => {
    setExpanded(!expanded);
  };

  const {annotation, uncertainty} = props.state.value?.annotation || {
    annotation: '',
    uncertainty: false,
  };

  const show =
    props.config.annotation.include || props.config.uncertainty.include;

  if (!show) {
    return null;
  }

  const handleAnnotationChange = (event: any) => {
    props.setFieldAnnotation({
      uncertainty: uncertainty,
      annotation: event.target.value,
    });
  };

  const handleUncertaintyChange = (event: any) => {
    props.setFieldAnnotation({
      uncertainty: event.target.checked,
      annotation: annotation,
    });
  };

  return (
    <>
      <IconButton color={'info'} size={'large'} onClick={handleExpandClick}>
        <NoteIcon />
      </IconButton>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box
          variant={'outlined'}
          component={Paper}
          elevation={0}
          sx={{ml: {xs: 0, sm: 2}, p: 2, my: 1}}
          bgcolor={grey[100]}
        >
          {props.config.annotation.include && (
            <TextField
              label={props.config.annotation.label}
              value={annotation || ''}
              onChange={handleAnnotationChange}
              fullWidth
              multiline
              minRows={3}
            />
          )}
          {props.config.uncertainty.include && (
            <Box mt={2} display="flex" alignItems="center">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={uncertainty || false}
                    onChange={handleUncertaintyChange}
                  />
                }
                label={props.config.uncertainty.label}
              />
            </Box>
          )}
        </Box>
      </Collapse>
    </>
  );
};
