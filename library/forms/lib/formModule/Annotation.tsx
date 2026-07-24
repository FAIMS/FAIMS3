import {FieldMeta, FormAnnotation, INPUT_LIMITS} from '@faims3/data-model';
import NoteIcon from '@mui/icons-material/Note';
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
import {useState} from 'react';
import {FaimsFormFieldState} from './types';

type FieldAnnotationProps = {
  config?: FieldMeta;
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

  // Fields may omit `meta` entirely, in which case there is no annotation or
  // uncertainty capture to render.
  const config = props.config;
  if (!config || !(config.annotation.include || config.uncertainty.include)) {
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
          component={Paper}
          sx={{ml: {xs: 0, sm: 2}, p: 2, my: 1, bgcolor: grey[100]}}
          variant="outlined"
          elevation={0}
        >
          {config.annotation.include && (
            <TextField
              label={config.annotation.label}
              value={annotation || ''}
              onChange={handleAnnotationChange}
              fullWidth
              multiline
              minRows={3}
              slotProps={{
                htmlInput: {maxLength: INPUT_LIMITS.LONG_TEXT_MAX_LENGTH},
              }}
            />
          )}
          {config.uncertainty.include && (
            <Box sx={{mt: 2, display: 'flex', alignItems: 'center'}}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={uncertainty || false}
                    onChange={handleUncertaintyChange}
                  />
                }
                label={config.uncertainty.label}
              />
            </Box>
          )}
        </Box>
      </Collapse>
    </>
  );
};
