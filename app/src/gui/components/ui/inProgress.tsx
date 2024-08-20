/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: inProgress.tsx
 * Description: A simple component to display a "Feature in progress" message with an icon.
 */

import TimelapseIcon from '@mui/icons-material/Timelapse';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';

/**
 * InProgress Component
 * This component is used to indicate that a feature is currently in progress.
 * It displays an icon and a text message, styled to be responsive and visually appealing.
 *
 * @component
 * @example
 * return (
 *   <InProgress />
 * )
 */
export default function InProgress() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        p: 2,
        borderRadius: 2,
        bgcolor: 'background.paper',
        boxShadow: 1,
        maxWidth: '100%',
        width: 'auto',
        margin: 'auto',
        textAlign: 'center',
      }}
    >
      <TimelapseIcon color="primary" sx={{ fontSize: 40, mr: 2 }} />
      <Typography variant="h6" component="span">
        Feature in progress
      </Typography>
    </Box>
  );
}
