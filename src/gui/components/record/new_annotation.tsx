import React from 'react';
import {styled} from '@mui/material/styles';
import {AccordionDetails, Typography, Box} from '@mui/material';
import MuiAccordion, {AccordionProps} from '@mui/material/Accordion';
import MuiAccordionSummary, {
  AccordionSummaryProps,
} from '@mui/material/AccordionSummary';
import NoteIcon from '@mui/icons-material/Note';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {AnnotationField} from './Annotation';
import {yellow, grey} from '@mui/material/colors';

const Accordion = styled((props: AccordionProps) => (
  <MuiAccordion disableGutters elevation={0} square {...props} />
))(({theme}) => ({
  border: `1px solid ${theme.palette.divider}`,
  '&:not(:last-child)': {
    borderBottom: 0,
  },
  '&:before': {
    display: 'none',
  },
}));

const AccordionSummary = styled((props: AccordionSummaryProps) => (
  <MuiAccordionSummary expandIcon={<ExpandMoreIcon />} {...props} />
))(({theme}) => ({
  backgroundColor:
    theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, .05)'
      : 'rgba(0, 0, 0, .03)',
  flexDirection: 'row-reverse',
  '& .MuiAccordionSummary-content': {
    marginLeft: theme.spacing(1),
  },
}));

type AnnotationProps = {
  isclicked: boolean;
  fieldName: string;
  field: any;
  handerannoattion: any;
  annotation: any;
  disabled?: boolean;
};

export default function AnnotationComponent(props: AnnotationProps) {
  return (props.field.meta !== undefined &&
    props.field.meta.annotation !== false) ||
    (props.field.meta !== undefined &&
      props.field.meta.uncertainty !== undefined &&
      props.field.meta.uncertainty.include !== false) ? (
    <Box>
      <Accordion>
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          aria-controls="panel1a-content"
          id="panel1a-header"
        >
          <NoteIcon sx={{mr: 1, color: yellow[800]}} />
          <Typography>Add note</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{p: 2}}>
          <AnnotationField
            key={'annotation-' + props.fieldName + '-box'}
            fieldName={props.fieldName}
            field={props.field}
            annotation={props.annotation}
            handerannoattion={props.handerannoattion}
            isclicked={true}
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  ) : (
    <Box></Box>
  );
}
