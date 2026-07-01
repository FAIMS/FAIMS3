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
 * Filename: impersonate-dialog.tsx
 * Description:
 *   Dialog allowing an authorised admin to pick a user to impersonate.
 */

import {GetListAllUsersItem, Role} from '@faims3/data-model';
import {
  Alert,
  Box,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from '@mui/material';
import {useQuery} from '@tanstack/react-query';
import React, {useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import * as ROUTES from '../../../constants/routes';
import {
  selectActiveUser,
  startImpersonation,
} from '../../../context/slices/authSlice';
import {useAppDispatch, useAppSelector} from '../../../context/store';
import {listUsers} from '../../../utils/apiOperations/users';

/**
 * A dialog which lists users on the active server and lets the admin start
 * impersonating one of them. The current user and cluster admins are excluded.
 */
export default function ImpersonateDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const activeUser = useAppSelector(selectActiveUser);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  // Pin the admin identity while the dialog is open. activeUser switches to the
  // impersonated user before onClose runs; without pinning, the user-list query
  // would refetch as that user (401 + retries).
  const [pinnedAdmin, setPinnedAdmin] = useState<{
    serverId: string;
    username: string;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      setPinnedAdmin(null);
      return;
    }
    setPinnedAdmin(prev => {
      if (prev) return prev;
      if (!activeUser || activeUser.impersonatingUser) return null;
      return {serverId: activeUser.serverId, username: activeUser.username};
    });
  }, [open, activeUser]);

  const {data, isLoading, isError, error} = useQuery({
    queryKey: [
      'impersonation-users',
      pinnedAdmin?.serverId,
      pinnedAdmin?.username,
    ],
    queryFn: async () =>
      listUsers(pinnedAdmin!.serverId, pinnedAdmin!.username),
    enabled: open && !!pinnedAdmin,
    networkMode: 'always',
    retry: false,
  });

  const candidates = useMemo(() => {
    const users = (data ?? []) as GetListAllUsersItem[];
    const term = search.trim().toLowerCase();
    return users
      .filter(u => {
        // cannot impersonate yourself
        if (u._id === pinnedAdmin?.username) return false;
        // cannot impersonate cluster admins
        if ((u.globalRoles ?? []).includes(Role.GENERAL_ADMIN)) return false;
        // cannot impersonate disabled accounts
        if (u.disabled) return false;
        return true;
      })
      .filter(u => {
        if (!term) return true;
        const email = u.emails[0]?.email ?? '';
        return (
          (u.name ?? '').toLowerCase().includes(term) ||
          u._id.toLowerCase().includes(term) ||
          email.toLowerCase().includes(term)
        );
      });
  }, [data, search, pinnedAdmin?.username]);

  const handleImpersonate = async (targetUserId: string) => {
    if (!pinnedAdmin) return;
    setPendingId(targetUserId);
    const {status} = await dispatch(
      startImpersonation({
        serverId: pinnedAdmin.serverId,
        targetUserId,
      })
    ).unwrap();
    setPendingId(null);
    if (status === 'success') {
      onClose();
      navigate(ROUTES.INDEX);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Impersonate a user</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{mb: 2}}>
          Choose a user to sign in as. You will see what they see, and actions
          you take will be performed as this user. Use “Return to your account”
          in the banner to end impersonation.
        </Typography>

        <TextField
          fullWidth
          size="small"
          label="Search by name, email or username"
          value={search}
          onChange={e => setSearch(e.target.value)}
          sx={{mb: 2}}
        />

        {isLoading && (
          <Box sx={{display: 'flex', justifyContent: 'center', p: 3}}>
            <CircularProgress />
          </Box>
        )}

        {isError && (
          <Alert severity="error">
            Could not load users:{' '}
            {error instanceof Error ? error.message : 'Unknown error'}
          </Alert>
        )}

        {!isLoading && !isError && candidates.length === 0 && (
          <Alert severity="info">No users available to impersonate.</Alert>
        )}

        {!isLoading && !isError && candidates.length > 0 && (
          <List dense sx={{maxHeight: 360, overflow: 'auto'}}>
            {candidates.map(user => (
              <ListItemButton
                key={user._id}
                disabled={pendingId !== null}
                onClick={() => handleImpersonate(user._id)}
              >
                <ListItemText
                  primary={user.name || user._id}
                  secondary={user.emails[0]?.email ?? user._id}
                />
                {pendingId === user._id && <CircularProgress size={18} />}
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}
