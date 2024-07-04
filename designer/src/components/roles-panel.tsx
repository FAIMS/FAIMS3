// Copyright 2023 FAIMS Project
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Alert, Button, Divider, IconButton, List, ListItem, ListItemText, Paper, TextField, Typography, Grid } from "@mui/material";

import { useState } from "react";
import { useAppSelector, useAppDispatch } from "../state/hooks";

import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import { Notebook } from '../state/initial';

/**
 * RolesPanel - edit the user roles associated with this notebook
 * which are stored in the "accesses" property in the metadata
 */
export const RolesPanel = () => {

    const roles = useAppSelector((state: Notebook) => state.metadata.accesses) as string[];
    const dispatch = useAppDispatch();

    const [newRole, setNewRole] = useState('');

    const addRole = () => {
        const newRoles = [...roles, newRole];
        dispatch({
            type: 'metadata/rolesUpdated',
            payload: { roles: newRoles }
        })
        setNewRole('');
    };

    const removeRole = (role: string) => {
        const newRoles = roles.filter((r) => r !== role);
        dispatch({
            type: 'metadata/rolesUpdated',
            payload: { roles: newRoles }
        });
    };

    return (
        <>
            <Typography variant="h2">User Roles</Typography>
            <Grid container spacing={2} pt={3}>
                <Grid item xs={12}>
                    <Alert severity="info">All projects have an admin, moderator, and team
                        roles by default. Define any new roles required here.
                        You will be able to assign users to these roles later
                        in the User tab.
                    </Alert>
                </Grid>
                <Grid item xs={4}>
                    <TextField
                        label="Add User Role"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)} />
                    {/* <Button onClick={addRole}>Add Role</Button> */}
                    <Button
                        color="primary"
                        startIcon={<AddCircleIcon />}
                        variant="outlined"
                        onClick={addRole}
                    >
                        ADD{' '}
                    </Button>
                </Grid>
                <Grid item xs={8}>
                    <List>
                        {roles.map((access: string) => {
                            return (
                                <Paper key={access}>
                                    <ListItem
                                        key={access}
                                        secondaryAction={
                                            <IconButton
                                                edge="end"
                                                aria-label="delete"
                                                onClick={() => removeRole(access)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        }>
                                        <ListItemText primary={access} />
                                    </ListItem>
                                    <Divider />
                                </Paper>
                            )
                        })}
                    </List>
                </Grid>
            </Grid>

        </>
    )
}