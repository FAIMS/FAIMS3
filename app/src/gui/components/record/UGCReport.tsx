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
 * Filename: UGCReport.tsx
 * Description:
 *   UGCReport
 */
import React from 'react';

import {
  Grid,
  TextField,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';
interface UGCReportProps {
  handleUGCReport: Function;
}

export default function UGCReport(props: UGCReportProps) {
  /**
   * Provide a mechanism for the user to report objectionable content.
   */
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState(null as string | null);
  const handleClickOpen = () => {
    setOpen(true);
  };
  const handleClose = () => {
    setOpen(false);
  };
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
  };
  const handleSubmit = () => {
    props.handleUGCReport(value);
    setValue(null);
    setOpen(false);
  };
  return (
    <Grid item sm={12} xs={12} md={12} sx={{mt: 1}}>
      <Grid container spacing={2}>
        <Grid item md={12}>
          <Button
            variant="text"
            onClick={handleClickOpen}
            startIcon={<OutlinedFlagIcon color={'secondary'} />}
            size={'small'}
          >
            Report
          </Button>
          <Dialog open={open} onClose={handleClose}>
            <DialogTitle>Need to report inappropriate content?</DialogTitle>
            <DialogContent>
              <TextField
                autoFocus
                id="ugc-comment"
                label="Tell us about the issue"
                margin="dense"
                multiline={true}
                rows={3}
                fullWidth
                variant="standard"
                helperText="If you are concerned about the content of this record, let us know why. Reporting content is anonymous, so other users can't tell who made the report."
                onChange={handleChange}
                value={value}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={value === null}
                variant={'contained'}
                disableElevation={true}
              >
                Send
              </Button>
            </DialogActions>
          </Dialog>
        </Grid>
      </Grid>
    </Grid>
  );
}
