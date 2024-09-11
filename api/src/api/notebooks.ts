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
 * Filename: routes.ts
 * Description:
 *   This module contains notebook related API routes at /api/notebooks
 */

import express from 'express';
import multer from 'multer';
import {
    DEVELOPER_MODE
} from '../buildconfig';
import { createManyRandomRecords } from '../couchdb/devtools';
import {
    createNotebook,
    deleteNotebook,
    getNotebookMetadata,
    getNotebookRecords,
    getNotebooks,
    getNotebookUISpec,
    getRolesForNotebook,
    streamNotebookFilesAsZip,
    streamNotebookRecordsAsCSV,
    updateNotebook
} from '../couchdb/notebooks';
import {
    addProjectRoleToUser,
    getUserFromEmailOrUsername,
    getUserInfoForNotebook, removeProjectRoleFromUser,
    saveUser,
    userCanCreateNotebooks,
    userHasPermission,
    userIsClusterAdmin
} from '../couchdb/users';
import { requireAuthenticationAPI } from '../middleware';

// TODO: configure this directory
const upload = multer({dest: '/tmp/'});

export const api = express.Router();

api.get('/', requireAuthenticationAPI, async (req, res) => {
  // get a list of notebooks from the db
  if (req.user) {
    const notebooks = await getNotebooks(req.user);
    res.json(notebooks);
  } else {
    res.json([]);
  }
});

/**
 * POST to /notebooks/ to create a new notebook
 */
api.post('/', requireAuthenticationAPI, async (req, res) => {
  if (req.user && userCanCreateNotebooks(req.user)) {
    const uiSpec = req.body['ui-specification'];
    const projectName = req.body.name;
    const metadata = req.body.metadata;

    try {
      const projectID = await createNotebook(projectName, uiSpec, metadata);
      if (projectID) {
        // allow this user to modify the new notebook
        addProjectRoleToUser(req.user, projectID, 'admin');
        await saveUser(req.user);
        res.json({notebook: projectID});
      } else {
        res.json({error: 'error creating the notebook'});
        res.status(500).end();
      }
    } catch (err) {
      res.json({error: 'there was an error creating the notebook'});
      res.status(500).end();
    }
  } else {
    res.json({
      error: 'you do not have permission to create notebooks on this server',
    });
    res.status(401).end();
  }
});

api.get('/:id', requireAuthenticationAPI, async (req, res) => {
  // get full details of a single notebook
  const project_id = req.params.id;
  if (req.user && userHasPermission(req.user, project_id, 'read')) {
    const metadata = await getNotebookMetadata(project_id);
    const uiSpec = await getNotebookUISpec(project_id);
    if (metadata && uiSpec) {
      res.json({metadata, 'ui-specification': uiSpec});
    } else {
      res.json({error: 'not found'});
      res.status(404).end();
    }
  } else {
    // unauthorised response
    res.status(401).end();
  }
});

// PUT a new version of a notebook
api.put('/:id', requireAuthenticationAPI, async (req, res) => {
  // user must have modify permissions on this notebook
  if (userHasPermission(req.user, req.params.id, 'modify')) {
    const uiSpec = req.body['ui-specification'];
    const metadata = req.body.metadata;
    const projectID = req.params.id;
    try {
      await updateNotebook(projectID, uiSpec, metadata);
      res.json({notebook: projectID});
    } catch (err) {
      res.json({error: 'there was an error creating the notebook'});
      console.log('Error creating notebook', err);
      res.status(500).end();
    }
  } else {
    res.json({
      error: 'you do not have permission to modify this notebook',
    });
    res.status(401).end();
  }
});

// export current versions of all records in this notebook
api.get(
  '/:id/records/',
  requireAuthenticationAPI,
  async (req, res) => {
    let records = [];
    if (req.user && userHasPermission(req.user, req.params.id, 'read')) {
      records = await getNotebookRecords(req.params.id);
    }
    if (records) {
      res.json({records});
    } else {
      res.json({error: 'notebook not found'});
      res.status(404).end();
    }
  }
);

// export current versions of all records in this notebook as csv
api.get(
  '/:id/:viewID.csv',
  requireAuthenticationAPI,
  async (req, res) => {
    if (req.user && userHasPermission(req.user, req.params.id, 'read')) {
      try {
        res.setHeader('Content-Type', 'text/csv');
        streamNotebookRecordsAsCSV(req.params.id, req.params.viewID, res);
      } catch (err) {
        console.log('Error streaming CSV', err);
        res.json({error: 'error creating CSV'});
        res.status(500).end();
      }
    } else {
      res.json({error: 'notebook not found'});
      res.status(404).end();
    }
  }
);

// export files for all records in this notebook as zip
api.get(
  '/:id/:viewid.zip',
  requireAuthenticationAPI,
  async (req, res) => {
    if (req.user && userHasPermission(req.user, req.params.id, 'read')) {
      res.setHeader('Content-Type', 'application/zip');
      streamNotebookFilesAsZip(req.params.id, req.params.viewid, res);
    } else {
      res.json({error: 'notebook not found'});
      res.status(404).end();
    }
  }
);

api.get('/:id/users/', requireAuthenticationAPI, async (req, res) => {
  // user must have admin access tot his notebook

  if (userHasPermission(req.user, req.params.id, 'modify')) {
    const userInfo = await getUserInfoForNotebook(req.params.id);
    res.json(userInfo);
  } else {
    res.json({
      error: 'you do not have permission to view users for this notebook',
    });
    res.status(401).end();
  }
});

// POST to give a user permissions on this notebook
// body includes:
//   {
//     username: 'a username or email',
//     role: a valid role for this notebook,
//     addrole: boolean, true to add, false to delete
//   }
api.post(
  '/:id/users/',
  requireAuthenticationAPI,
  async (req, res) => {
    if (userHasPermission(req.user, req.params.id, 'modify')) {
      let error = '';
      const notebook = await getNotebookMetadata(req.params.id);
      if (notebook) {
        const username = req.body.username;
        const role = req.body.role;
        const addrole = req.body.addrole;

        // check that this is a legitimate role for this notebook
        const notebookRoles = await getRolesForNotebook(notebook.project_id);
        if (notebookRoles.indexOf(role) >= 0) {
          const user = await getUserFromEmailOrUsername(username);
          if (user) {
            if (addrole) {
              await addProjectRoleToUser(user, notebook.project_id, role);
            } else {
              await removeProjectRoleFromUser(user, notebook.project_id, role);
            }
            await saveUser(user);
            res.json({status: 'success'});
            return;
          } else {
            error = 'Unknown user ' + username;
          }
        } else {
          error = 'Unknown role';
        }
      } else {
        error = 'Unknown notebook';
      }
      // user or project not found or bad role
      res.status(404);
      res.json({status: 'error', error}).end();
    } else {
      res.status(401);
      res
        .json({
          status: 'error',
          error: 'you do not have permission to modify users for this notebook',
        })
        .end();
    }
  }
);

api.post(
  '/:notebook_id/delete',
  requireAuthenticationAPI,
  async (req, res) => {
    if (userIsClusterAdmin(req.user)) {
      const project_id = req.params.notebook_id;
      const notebook = await getNotebookMetadata(project_id);
      if (notebook) {
        await deleteNotebook(project_id);
        res.redirect('/notebooks/');
      } else {
        res.status(404).end();
      }
    } else {
      res.status(401).end();
    }
  }
);

if (DEVELOPER_MODE) {
  api.post(
    '/:notebook_id/generate',
    requireAuthenticationAPI,
    async (req, res) => {
      if (userIsClusterAdmin(req.user)) {
        const project_id = req.params.notebook_id;
        const count = req.body.count || 1;
        const record_ids = await createManyRandomRecords(project_id, count);
        res.json({record_ids});
        res.status(200).end();
      } else {
        res.status(401).end();
      }
    }
  );
}
