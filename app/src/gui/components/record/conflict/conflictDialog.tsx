/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: RecordTabBar.tsx
 * Description:
 *   File contains:
 *  ConflictHelpDialog
 *    - shows user how to work on conflict resolution
 *  ConflictInfoDialog
 *   - Shows User what is Conflict
 *  EditConflictDialogue
 *   - In Record Edit Tab shows user the information for Conflict Icon and help user choose resolve conflict
 *
 */

import * as React from 'react';
import {createTheme, styled} from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import CloseIcon from '@mui/icons-material/Close';
import WarningIcon from '@mui/icons-material/Warning';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {FieldButton, iconstyle} from './conflictbutton';
import DoneIcon from '@mui/icons-material/Done';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Grid,
  Button,
  Box,
  IconButton,
  Typography,
  AlertTitle,
  Stack,
} from '@mui/material';
import {card_styles} from './conflictstyle';
import InfoIcon from '@mui/icons-material/Info';
import CheckBoxIcon from '@mui/icons-material/CheckBox';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';

export function ConflictButton(props: any) {
  return (
    <Button
      aria-label={props.text}
      onClick={() => props.onButtonClick(props.id)}
      value={props.value}
      id={props.id}
      variant={props.ischoose ? 'outlined' : 'contained'}
      style={{height: '56px'}}
      disabled={props.disabled}
      disableElevation={true}
    >
      {props.text}
    </Button>
  );
}
const theme = createTheme();

const ConflictDialog = styled(Dialog)(() => ({
  '& .MuiDialogContent-root': {
    padding: theme.spacing(2),
  },
  '& .MuiDialogActions-root': {
    padding: theme.spacing(1),
  },
}));

export interface DialogTitleProps {
  id: string;
  children?: React.ReactNode;
  onClose: () => void;
}

const ConflictDialogTitle = (props: DialogTitleProps) => {
  const {children, onClose, ...other} = props;

  return (
    <DialogTitle sx={{m: 0, p: 2}} {...other}>
      {children}
      {onClose ? (
        <IconButton
          aria-label="close"
          onClick={onClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: theme => theme.palette.grey[500],
          }}
        >
          <CloseIcon />
        </IconButton>
      ) : null}
    </DialogTitle>
  );
};

function ConflictDialogContent() {
  return (
    <Box p={2}>
      <Grid container spacing={{xs: 2, md: 3}}>
        <Grid
          item
          xs={12}
          container
          justifyContent="flex-start"
          alignItems="flex-start"
        >
          <Typography>
            When you work in a team, occasionally somebody may change a record
            you are currently working on. If these changes do not overlap (i.e.,
            changes were made to different fields), the conflicting records are
            merged automatically. However, if the same fields were affected,
            Fieldmark™ cannot pick one side over the other, and asks you to
            resolve the conflict using the Conflict Resolution Tool.
            <br />
            <br />
          </Typography>
          <Typography>
            This tool consists of three panes:
            <ul>
              <li>
                The left pane shows the data entered for the conflicting fields
                from Revision A (selected from the left-hand dropdown).
              </li>
              <li>
                The right pane shows the data saved for the conflicting fields
                from Revision B (selected from the right-hand dropdown).
              </li>
              <li>
                The central pane shows the results of resolving conflicts per
                field.
              </li>
            </ul>
          </Typography>
          <Typography>
            You can choose to accept the value of a field from Revision A or
            Revision B. Once you have chosen a value, no further action is
            required for that field.
            <br />
            <br />
          </Typography>
          <Typography>
            To automatically accept all conflicting changes from Revision A or
            B, click the Choose A or Choose B button.
            <br />
            <br />
          </Typography>
          <Typography>
            Once you have made a decision (chosen a side, or rejected both
            values) on all fields, you may save the result to the record, ending
            the conflict resolution process.
            <br />
            <br />
          </Typography>
          <Typography
            alignItems="flex-start"
            justifyContent="flex-start"
            variant="h6"
          >
            A quick-help component key is shown below:
          </Typography>
        </Grid>
        <Grid
          item
          xs={12}
          container
          justifyContent="flex-start"
          alignItems="center"
        >
          <Grid
            item
            xs={3}
            container
            justifyContent="center"
            alignItems="center"
            style={{paddingRight: 5}}
          >
            <FieldButton
              onButtonClick={() => console.log('click')}
              startIcon={<DeleteOutlineIcon style={iconstyle.icon} />}
              id={''}
              disabled={false}
              style={iconstyle.button}
            />
          </Grid>
          <Grid
            item
            xs={9}
            container
            justifyContent="flex-start"
            alignItems="center"
          >
            {'  '}discard this field value from revision A/B
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <hr />
        </Grid>
        <Grid
          item
          xs={12}
          container
          justifyContent="flex-start"
          alignItems="center"
        >
          <Grid
            item
            xs={3}
            container
            justifyContent="center"
            alignItems="center"
            style={{paddingRight: 5}}
          >
            <FieldButton
              onButtonClick={() => console.log('click')}
              startIcon={<DoneIcon style={iconstyle.icon} />}
              id={''}
              disabled={false}
              style={iconstyle.button}
            />
          </Grid>
          <Grid
            item
            xs={9}
            container
            justifyContent="flex-start"
            alignItems="center"
          >
            {'  '}accept this field value from revision A/B
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <hr />
        </Grid>

        <Grid
          item
          xs={12}
          container
          justifyContent="flex-start"
          alignItems="center"
        >
          <Grid
            item
            xs={3}
            container
            justifyContent="center"
            alignItems="center"
            style={{paddingRight: 5}}
          >
            <InfoIcon style={card_styles.conflict.iconstyle} />
          </Grid>
          <Grid
            item
            xs={9}
            container
            justifyContent="flex-start"
            alignItems="center"
          >
            {'  '}displays the initial number of conflicting fields on the
            revisions
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <hr />
        </Grid>
        <Grid
          item
          xs={12}
          container
          justifyContent="flex-start"
          alignItems="center"
        >
          <Grid
            item
            xs={3}
            container
            justifyContent="center"
            alignItems="center"
            style={{paddingRight: 5}}
          >
            <InfoIcon style={card_styles.warning.iconstyle} />
          </Grid>
          <Grid
            item
            xs={9}
            container
            justifyContent="flex-start"
            alignItems="center"
          >
            {'  '}displays the number of conflicting fields on the revisions yet
            to be resolved
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <hr />
        </Grid>
        <Grid
          item
          xs={12}
          container
          justifyContent="flex-start"
          alignItems="center"
        >
          <Grid
            item
            xs={3}
            container
            justifyContent="center"
            alignItems="center"
            style={{paddingRight: 5}}
          >
            <CheckBoxIcon style={card_styles.success.iconstyle} />
          </Grid>
          <Grid
            item
            xs={9}
            container
            justifyContent="flex-start"
            alignItems="center"
          >
            {'  '}displays the number of conflicting fields on the revisions
            that have been resolved
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <hr />
        </Grid>
        <Grid
          item
          xs={12}
          container
          justifyContent="flex-start"
          alignItems="center"
        >
          <Grid
            item
            xs={3}
            container
            justifyContent="center"
            alignItems="center"
            style={{paddingRight: 5}}
          >
            <ErrorOutlineOutlinedIcon style={card_styles.delete.iconstyle} />
          </Grid>
          <Grid
            item
            xs={9}
            container
            justifyContent="flex-start"
            alignItems="center"
          >
            <Typography>
              {'  '}displays the number of conflicting fields on the revisions
              where both values have been rejected, and the field will be
              removed from the record
            </Typography>
          </Grid>
        </Grid>
        <Grid item xs={12}>
          <hr />
        </Grid>
        <Grid
          item
          xs={12}
          container
          justifyContent="flex-start"
          alignItems="center"
        >
          <Grid
            item
            xs={3}
            container
            justifyContent="center"
            alignItems="center"
            style={{paddingRight: 5}}
          >
            <ConflictButton
              onButtonClick={() => {
                console.debug('');
              }}
              text="Choose A"
              ischoose={false}
            />
          </Grid>
          <Grid
            item
            xs={9}
            container
            justifyContent="flex-start"
            alignItems="center"
          >
            {'  '}automatically accept all conflicting changes from Revision A
            or B
          </Grid>
        </Grid>
        <Grid
          item
          xs={12}
          container
          justifyContent="flex-start"
          alignItems="flex-start"
        >
          <Typography>
            <br />
            For more detailed information and help with the conflict resolution
            process, view the docs.
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
}

function ConflictInfoContent() {
  return (
    <Box>
      <Typography gutterBottom>
        Conflicts generally arise when two users have changed the same fields in
        a record, or if the user deleted a file while another user was modifying
        it. In these cases, FAIMS cannot automatically determine what is
        correct.
        <br />
      </Typography>
      <Typography gutterBottom>
        The record will be marked as conflicted. It is then the users'
        responsibility to resolve the conflict.
        <br />
      </Typography>
      <Typography gutterBottom>
        Users may continue to edit records whilst conflicts exist, but should be
        aware that doing so may create further conflicts, it is advisable to
        resolve all conflicts before editing.
        <br />
      </Typography>
    </Box>
  );
}

type ConflictHelpDialogProps = {
  type?: string;
};

export function ConflictHelpDialog(props: ConflictHelpDialogProps) {
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };

  return (
    <React.Fragment>
      {props.type ? (
        <Button
          color="inherit"
          size="small"
          startIcon={<InfoOutlinedIcon />}
          onClick={handleClickOpen}
        >
          Why am I seeing this?
        </Button>
      ) : (
        <Stack direction="row" alignItems="center" gap={1}>
          <IconButton
            color="primary"
            aria-label="upload picture"
            component="span"
            onClick={handleClickOpen}
          >
            <InfoOutlinedIcon />
          </IconButton>
          <Typography variant="caption" display="block">
            Conflict Resolution Help
          </Typography>
        </Stack>
      )}

      <ConflictDialog
        onClose={handleClose}
        aria-labelledby="customized-dialog-title"
        open={open}
      >
        <ConflictDialogTitle id="customized-dialog-title" onClose={handleClose}>
          <Grid container justifyContent="center" alignItems="center">
            <InfoOutlinedIcon />{' '}
          </Grid>
          <Grid container justifyContent="center" alignItems="center">
            <Typography>
              {props.type ? 'What is a Conflict?' : 'Conflict Resolution Help'}
            </Typography>
          </Grid>
        </ConflictDialogTitle>
        <DialogContent dividers>
          {props.type ? <ConflictInfoContent /> : <ConflictDialogContent />}
        </DialogContent>
        <DialogActions>
          <Button autoFocus onClick={handleClose}>
            Close
          </Button>
        </DialogActions>
      </ConflictDialog>
    </React.Fragment>
  );
}

function ConflictChildDialog(props: {
  handleChangeTab: Function;
  handleparentClose: Function;
}) {
  const [open, setOpen] = React.useState(false);

  const handleOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    props.handleparentClose(false);
    setOpen(false);
  };

  const handleConfirm = (event: React.ChangeEvent<{}>) =>
    props.handleChangeTab(event, '4');

  return (
    <Grid container>
      <Button
        onClick={handleOpen}
        color={'primary'}
        variant={'contained'}
        disableElevation={true}
      >
        Resolve Conflicts
      </Button>
      <BasicDialog
        handleClose={handleClose}
        handleOpen={handleOpen}
        handleConfirm={handleConfirm}
        content={
          'If you proceed to the Conflicts tab, all changes made here will be lost'
        }
        continue={'PROCEED TO CONFLICTS'}
        cancel={'Continue Editing'}
        open={open}
      />
    </Grid>
  );
}

export function DiscardDialog(props: any) {
  const [open, setOpen] = React.useState(false);

  const handleOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };

  const handleConfirm = (event: React.ChangeEvent<{}>) => {
    props.discardconflict(event);
    setOpen(false);
  };

  return (
    <>
      <Button
        value={'conflictDiscard'}
        id={'conflictDiscard'}
        variant="text"
        onClick={handleOpen}
        disabled={props.disabled}
      >
        Discard
      </Button>
      <BasicDialog
        handleClose={handleClose}
        handleOpen={handleOpen}
        handleConfirm={handleConfirm}
        content={'If you proceed, all changes made here will be lost'}
        continue={'Discard'}
        cancel={'Cancel'}
        open={open}
      />
    </>
  );
}

type BasicDialogProps = {
  handleClose: any;
  handleOpen: any;
  handleConfirm: any;
  content: string;
  continue: string;
  cancel: string;
  open: boolean;
};

export function BasicDialog(props: BasicDialogProps) {
  return (
    <Dialog
      open={props.open}
      onClose={props.handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <Alert severity={'warning'}>
        <AlertTitle>Are you sure?</AlertTitle>
        {props.content}
      </Alert>
      <DialogActions>
        <Button onClick={props.handleClose} autoFocus>
          {props.cancel}
        </Button>
        <Button onClick={props.handleConfirm}>{props.continue}</Button>
      </DialogActions>
    </Dialog>
  );
}

export function EditConflictDialog(props: {
  handleChangeTab: Function;
  label: string;
}) {
  const {label} = props;
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };
  return (
    <Box>
      <IconButton color={'warning'} onClick={handleClickOpen} size={'large'}>
        <WarningIcon />
      </IconButton>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <Alert severity={'warning'}>
          <AlertTitle> {label} field is in Conflict</AlertTitle>
          This record contains conflicting data for the {label} field. If you
          wish to resolve the conflicting data, go to the conflicts tab (you
          will lose any changes you have made here).
        </Alert>
        <DialogActions>
          <ConflictChildDialog
            handleparentClose={handleClose}
            handleChangeTab={props.handleChangeTab}
          />
          <Button onClick={handleClose} autoFocus>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
