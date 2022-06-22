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
 *    - shows User How to work on Conflict Resolve
 *  ConflictInfoDialog
 *   - Shows User what is Conflict
 *  EditConflictDisalog
 *   - In Record Edit Tab shows user the information for Conflict Icon and help user choose resove conflict
 *
 */

import * as React from 'react';
import Button from '@mui/material/Button';
import {styled} from '@mui/material/styles';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import CloseIcon from '@mui/icons-material/Close';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  CircularProgress,
  Grid,
  Box,
  Card,
  CardHeader,
  IconButton,
  Typography,
} from '@mui/material';
import {FieldButton, iconstyle} from './conflictbutton';
import DoneIcon from '@mui/icons-material/Done';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {cardsstyles} from './conflictstyle';

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
    >
      {props.text}
    </Button>
  );
}

const ConflictDialog = styled(Dialog)(({theme}) => ({
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
    <Box pb={20} pt={10} pl={3} pr={3}>
      <Grid container spacing={{xs: 2, md: 3}}>
        <Grid
          item
          xs={12}
          container
          justifyContent="center"
          alignItems="flex-end"
        >
          <Typography>
            The most recent conflict has been pre-selected. Choose another using
            the dropdown box
          </Typography>
          <br />
        </Grid>
        <Grid
          item
          xs={6}
          container
          justifyContent="center"
          alignItems="flex-end"
        >
          <CircularProgress />
        </Grid>
        <Grid item xs={6}>
          <Typography>
            Confilct is still downloading to this device, and it not yet
            selectable.
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <br />
        </Grid>
        <Grid
          item
          xs={6}
          container
          justifyContent="center"
          alignItems="flex-end"
        >
          <ConflictButton
            onButtonClick={() => {
              console.debug('');
            }}
            text="Choose A"
            ischoose={false}
          />
        </Grid>
        <Grid item xs={6}>
          <Typography>
            Select all conflicts from conflict A(disregard all from conflict B)
          </Typography>
        </Grid>
        <Grid
          item
          xs={6}
          container
          justifyContent="center"
          alignItems="flex-end"
        >
          <FieldButton
            onButtonClick={() => console.log('click')}
            startIcon={<DeleteOutlineIcon style={iconstyle} />}
            id={''}
            disabled={false}
          />
        </Grid>
        <Grid item xs={6}>
          <Typography>Click to reject conflict</Typography>
        </Grid>
        <Grid
          item
          xs={6}
          container
          justifyContent="center"
          alignItems="flex-end"
        >
          <Card style={{width: '100%'}}>
            <CardHeader
              title={''}
              style={cardsstyles.reject.cardheader}
              action={
                <IconButton sx={{color: 'white'}}>
                  {cardsstyles.reject.icon}
                </IconButton>
              }
            />
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Typography>Field in conflict Rejected</Typography>
        </Grid>
        <Grid
          item
          xs={6}
          container
          justifyContent="center"
          alignItems="flex-end"
        >
          <FieldButton
            onButtonClick={() => console.log('click')}
            startIcon={<DoneIcon style={iconstyle} />}
            id={''}
            disabled={false}
          />
        </Grid>
        <Grid item xs={6}>
          <Typography>Click to accept conflict</Typography>
        </Grid>
        <Grid
          item
          xs={6}
          container
          justifyContent="center"
          alignItems="flex-end"
        >
          <Card style={{width: '100%'}}>
            <CardHeader
              title={''}
              style={cardsstyles.success.cardheader}
              action={
                <IconButton sx={{color: 'white'}}>
                  {cardsstyles.success.icon}
                </IconButton>
              }
            />
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Typography>Field in conflict Accepted</Typography>
        </Grid>
        <Grid
          item
          xs={6}
          container
          justifyContent="center"
          alignItems="flex-end"
        >
          <Card style={{width: '100%'}}>
            <CardHeader
              title={''}
              style={cardsstyles.delete.cardheader}
              action={
                <IconButton sx={{color: 'white'}}>
                  {cardsstyles.delete.icon}
                </IconButton>
              }
            />
          </Card>
        </Grid>
        <Grid item xs={6}>
          <Typography>
            Reject value in both conflict, field will be set empty.{' '}
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
}

function ConflictInfoContent() {
  return (
    <Box pb={10} pt={10} pl={3} pr={3}>
      <Typography>
        Conflicts generally arise when two users have changed the same fields in
        a record, or if the user deleted a file while another user was modifying
        it. In these cases, FAIMS cannot automatically detemine what is correct.
      </Typography>
      <Typography>
        The record will be marked as conflicted. It is then the users'
        responsibility to resolve the conflict.
      </Typography>
      <Typography>
        Users may continue to edit records whilst conflicts exist, but should be
        aware that doing so may create futher conflicts, it is advisable to
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
    <Grid container>
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
        <Grid
          item
          xs={6}
          container
          justifyContent="flex-start"
          alignItems="center"
        >
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
        </Grid>
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
    </Grid>
  );
}

function ConflictChildDialog(props: any) {
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
      <Button onClick={handleOpen}>Resolve Conflicts</Button>
      <BasicDiaglog
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
      >
        Discard
      </Button>
      <BasicDiaglog
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

type BasicDiaglogProps = {
  handleClose: any;
  handleOpen: any;
  handleConfirm: any;
  content: string;
  continue: string;
  cancel: string;
  open: boolean;
};

export function BasicDiaglog(props: BasicDiaglogProps) {
  return (
    <Dialog
      open={props.open}
      onClose={props.handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{' Alert '}</DialogTitle>
      <DialogContent style={{width: '600px', height: '100px'}}>
        <DialogContentText id="alert-dialog-description">
          {props.content}
          <br />
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.handleConfirm}>{props.continue}</Button>
        <Button onClick={props.handleClose} autoFocus>
          {props.cancel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function EditConflictDisalog(props: any) {
  const {label} = props;
  const [open, setOpen] = React.useState(false);

  const handleClickOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };

  return (
    <Grid container>
      <Button
        variant="contained"
        style={{
          textTransform: 'none',
          backgroundColor: '#f9dbaf',
          borderRadius: 35,
          color: '#f29c3e',
        }}
        startIcon={
          <InfoOutlinedIcon style={{paddingLeft: 0, paddingRight: 0}} />
        }
        onClick={handleClickOpen}
        size="small"
      >
        Conflict
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {label} field is in Conflict
        </DialogTitle>
        <DialogContent style={{width: '600px', height: '100px'}}>
          <DialogContentText id="alert-dialog-description">
            This record contains conflicting data for the {label} field. If you
            wish to resolve the conflicting data, go to the conflicts tab(you
            will lose any changes you have made here)
          </DialogContentText>
        </DialogContent>
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
    </Grid>
  );
}
