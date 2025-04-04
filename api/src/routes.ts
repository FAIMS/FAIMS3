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
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */
<<<<<<< HEAD
import {NonUniqueProjectID} from '@faims3/data-model';
import {body, validationResult} from 'express-validator';
=======
import {
  Action,
  projectInviteToAction,
  Resource,
  Role,
  roleDetails,
  RoleScope,
  userHasGlobalRole,
  userHasProjectRole,
} from '@faims3/data-model';
>>>>>>> origin/main
import QRCode from 'qrcode';
import {app} from './core';
import {add_auth_providers} from './auth_providers';
import {add_auth_routes} from './auth_routes';
import {generateUserToken} from './authkeys/create';
import {
  ANDROID_APP_URL,
  CONDUCTOR_AUTH_PROVIDERS,
  CONDUCTOR_PUBLIC_URL,
  COUCHDB_INTERNAL_URL,
  DESIGNER_URL,
  DEVELOPER_MODE,
  IOS_APP_URL,
  WEBAPP_PUBLIC_URL,
} from './buildconfig';
import {createInvite, getInvitesForNotebook} from './couchdb/invites';
import {
  countRecordsInNotebook,
  getNotebookMetadata,
  getEncodedNotebookUISpec,
  getNotebooks,
  getRolesForNotebook,
} from './couchdb/notebooks';
import {getTemplate, getTemplates} from './couchdb/templates';
import {
  getUserInfoForNotebook,
  getUsers,
  userCanCreateNotebooks,
  userHasPermission,
  userIsClusterAdmin,
} from './couchdb/users';
import {
  requireAuthentication,
  requireClusterAdmin,
  requireNotebookMembership,
} from './middleware';
import {validateProjectDatabase} from './couchdb/devtools';
import {
  databaseValidityReport,
  initialiseDbAndKeys,
  verifyCouchDBConnection,
} from './couchdb';
<<<<<<< HEAD
=======
import {validateProjectDatabase} from './couchdb/devtools';
import {createInvite, getInvitesForNotebook} from './couchdb/invites';
import {
  countRecordsInNotebook,
  getEncodedNotebookUISpec,
  getNotebookMetadata,
  getRolesForNotebook,
  getUserProjectsDetailed,
} from './couchdb/notebooks';
import {getTemplate, getTemplates} from './couchdb/templates';
import {getUsers, getUsersForResource} from './couchdb/users';
import {
  isAllowedToMiddleware,
  requireAuthentication,
  requireNotebookMembership,
  userCanDo,
} from './middleware';
>>>>>>> origin/main

export {app};

add_auth_providers(CONDUCTOR_AUTH_PROVIDERS);
add_auth_routes(app, CONDUCTOR_AUTH_PROVIDERS);

/**
 * Home Page
 *
 */
app.get('/', async (req, res) => {
  if (databaseValidityReport.valid) {
    if (req.user && req.user._id) {
      const provider = Object.keys(req.user.profiles)[0];
      // No need for a refresh here
      const token = await generateUserToken(req.user, false);

      res.render('home', {
        user: req.user,
        token: token.token,
        cluster_admin: userIsClusterAdmin(req.user),
        can_create_notebooks: userCanCreateNotebooks(req.user),
        provider: provider,
        developer: DEVELOPER_MODE,
        ANDROID_APP_URL: ANDROID_APP_URL,
        IOS_APP_URL: IOS_APP_URL,
        WEBAPP_PUBLIC_URL: WEBAPP_PUBLIC_URL,
      });
    } else {
      res.redirect('/auth/');
    }
  } else {
    res.render('fallback', {
      report: databaseValidityReport,
      couchdb_url: COUCHDB_INTERNAL_URL,
      layout: 'fallback',
    });
  }
});

/**
 * POST to /fallback-initialise does initialisation on the databases
 * - this does not have any auth requirement because it should be used
 *   to set up the users database and create the admin user
 *   if databases exist, this is a no-op
 *   Extra guard, if the db report says everything is ok we don't
 *   even call initialiseDatabases, just redirect home
 */
app.post('/fallback-initialise', async (req, res) => {
  if (!databaseValidityReport.valid) {
    console.log('running initialise');
    await initialiseDbAndKeys({});
    const vv = await verifyCouchDBConnection();
    console.log('updated valid', databaseValidityReport, vv);
  }
  res.redirect('/');
});

app.get('/notebooks/:id/invite/', requireAuthentication, async (req, res) => {
  if (await userHasPermission(req.user, req.params.id, 'modify')) {
    const notebook = await getNotebookMetadata(req.params.id);
    if (notebook) {
      res.render('invite', {
        notebook: notebook,
        roles: await getRolesForNotebook(req.params.id),
      });
    } else {
      res.status(404).end();
    }
  } else {
    res.status(401).end();
  }
});

app.post(
  '/notebooks/:id/invite/',
  requireAuthentication,
  body('role').not().isEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('invite-error', {errors: errors.array()});
    }
    const project_id: NonUniqueProjectID = req.params.id;
    const role: string = req.body.role;

    if (!userHasPermission(req.user, project_id, 'modify')) {
      res.render('invite-error', {
        errors: [
          {
            msg: `You do not have permission to invite users to project ${project_id}`,
            location: 'header',
            param: 'user',
          },
        ],
      });
<<<<<<< HEAD
=======
      return;
    }
    await createInvite(projectId, role);
    res.redirect('/notebooks/' + projectId);
  }
);

app.get(
  '/notebooks/',
  requireAuthentication,
  isAllowedToMiddleware({action: Action.LIST_PROJECTS}),
  async (req, res) => {
    const user = req.user;
    if (user) {
      const notebooks = await getUserProjectsDetailed(user);
      const ownNotebooks = notebooks.filter(nb => nb.is_admin);
      const otherNotebooks = notebooks.filter(nb => !nb.is_admin);

      res.render('notebooks', {
        user: user,
        ownNotebooks: ownNotebooks,
        otherNotebooks: otherNotebooks,
        cluster_admin: userHasGlobalRole({role: Role.GENERAL_ADMIN, user}),
        can_create_notebooks: userCanDo({
          action: Action.CREATE_PROJECT,
          user,
        }),
        developer: DEVELOPER_MODE,
        DESIGNER_URL: DESIGNER_URL,
      });
>>>>>>> origin/main
    } else {
      await createInvite(project_id, role);
      res.redirect('/notebooks/' + project_id);
    }
  }
);

app.get('/notebooks/', requireAuthentication, async (req, res) => {
  const user = req.user;
  if (user) {
    const notebooks = await getNotebooks(user);

    const ownNotebooks = notebooks.filter(nb => nb.is_admin);
    const otherNotebooks = notebooks.filter(nb => !nb.is_admin);

    res.render('notebooks', {
      user: user,
      ownNotebooks: ownNotebooks,
      otherNotebooks: otherNotebooks,
      cluster_admin: userIsClusterAdmin(user),
      can_create_notebooks: userCanCreateNotebooks(user),
      developer: DEVELOPER_MODE,
      DESIGNER_URL: DESIGNER_URL,
    });
  } else {
    res.status(401).end();
  }
});

app.get(
  '/notebooks/:notebook_id/',
  requireNotebookMembership,
  async (req, res) => {
    const user = req.user as Express.User; // requireAuthentication ensures user
    const project_id = req.params.notebook_id;
    const notebook = await getNotebookMetadata(project_id);
    const uiSpec = await getEncodedNotebookUISpec(project_id);
    const invitesQR: any[] = [];
    if (notebook && uiSpec) {
<<<<<<< HEAD
      const isAdmin = userHasPermission(user, project_id, 'modify');
=======
      const isAdmin = userHasProjectRole({
        user,
        projectId: project_id,
        role: Role.PROJECT_ADMIN,
      });
>>>>>>> origin/main
      if (isAdmin) {
        const invites = await getInvitesForNotebook(project_id);
        for (let index = 0; index < invites.length; index++) {
          const invite = invites[index];
          const url = CONDUCTOR_PUBLIC_URL + '/register/' + invite._id;
          invitesQR.push({
            invite: invite,
            url: url,
            qrcode: await QRCode.toDataURL(url),
          });
        }
      }
      res.render('notebook-landing', {
        isAdmin: isAdmin,
        cluster_admin: userIsClusterAdmin(user),
        can_create_notebooks: userCanCreateNotebooks(req.user),
        notebook: notebook,
        records: await countRecordsInNotebook(project_id),
        invites: invitesQR,
        views: Object.keys(uiSpec.viewsets).map((key: string) => {
          return {label: uiSpec.viewsets[key].label, id: key};
        }),
        developer: DEVELOPER_MODE,
        DESIGNER_URL: DESIGNER_URL,
      });
    } else {
      res.sendStatus(404);
    }
  }
);

<<<<<<< HEAD
app.get('/templates/', requireAuthentication, async (req, res) => {
  const user = req.user;
  if (userCanCreateNotebooks(user)) {
    const templates = await getTemplates();
=======
app.get(
  '/templates/',
  requireAuthentication,
  isAllowedToMiddleware({action: Action.LIST_TEMPLATES}),
  async (req, res) => {
    const user = req.user!;
    // permission visibility filter (TODO optimise lookup by filtering based on
    // user visibility pre-query?)
    const templates = (await getTemplates({})).filter(t =>
      userCanDo({action: Action.READ_TEMPLATE_DETAILS, user, resourceId: t._id})
    );
>>>>>>> origin/main
    res.render('templates', {
      user: user,
      templates: templates,
      cluster_admin: userIsClusterAdmin(user),
      can_create_notebooks: userCanCreateNotebooks(req.user),
      developer: DEVELOPER_MODE,
    });
  } else {
    res.status(401).end();
  }
});

app.get(
  '/templates/:template_id/',
  requireNotebookMembership,
  async (req, res) => {
    const user = req.user as Express.User; // requireAuthentication ensures user
    if (!userCanCreateNotebooks(user)) {
      res.status(401).end();
    }
    const template_id = req.params.template_id;
    const template = await getTemplate(template_id);
    if (template) {
      res.render('template-landing', {
        user: user,
        cluster_admin: userIsClusterAdmin(user),
        can_create_notebooks: userCanCreateNotebooks(user),
        template: template,
        developer: DEVELOPER_MODE,
      });
    } else {
      res.sendStatus(404);
    }
  }
);

app.get('/send-token/', (req, res) => {
  if (req.user) {
    res.render('send-token', {
      user: req.user,
      web_url: WEBAPP_PUBLIC_URL,
      android_url: ANDROID_APP_URL,
      ios_url: IOS_APP_URL,
      app_id: 'org.fedarch.faims3', // only needed for compatibility with old versions of the app
    });
  } else {
    res.redirect('/');
  }
});

/**
 *
 * For a logged in user (via session), generates a new token and returns the result.
 */
app.get('/get-token/', async (req, res) => {
  if (req.user) {
    try {
      // No need for a refresh here
      const token = await generateUserToken(req.user, false);
      res.send(token);
    } catch {
      res.status(500).send('Signing key not set up');
    }
  } else {
    res.status(403).end();
  }
  return;
});

<<<<<<< HEAD
app.get('/notebooks/:id/users', requireClusterAdmin, async (req, res) => {
  if (req.user) {
    const project_id = req.params.id;

    const notebook = await getNotebookMetadata(project_id);

    const userList = await getUserInfoForNotebook(project_id);
=======
app.get(
  '/notebooks/:id/users',
  requireAuthentication,
  isAllowedToMiddleware({action: Action.VIEW_USER_LIST}),
  processRequest({params: z.object({id: z.string().nonempty()})}),
  async (req, res) => {
    const projectId = req.params.id;
    const user = req.user!;
    const notebook = await getNotebookMetadata(projectId);
    const relevantRoles = getRolesForNotebook().map(r => r.role);
    const userList = (await getUsersForResource({resourceId: projectId})).map(
      user => {
        const roles: {name: Role; value: boolean}[] = [];
        for (const r of relevantRoles) {
          roles.push({
            value: userHasProjectRole({
              role: r,
              user,
              projectId: projectId,
            }),
            name: r,
          });
        }
        return {...user, roles};
      }
    );
>>>>>>> origin/main

    res.render('users', {
      roles: userList.roles,
      users: userList.users,
      notebook: notebook,
      cluster_admin: userIsClusterAdmin(req.user),
      can_create_notebooks: userCanCreateNotebooks(req.user),
      developer: DEVELOPER_MODE,
    });
  } else {
    res.status(401).end();
  }
});

app.get('/users', requireClusterAdmin, async (req, res) => {
  if (req.user) {
    const id = req.user._id;
    const userList = await getUsers();

    const userListFiltered = userList
      .filter(user => user._id !== id)
      .map(user => {
        return {
          username: user._id,
          name: user.name,
          can_create_notebooks: userCanCreateNotebooks(user),
          is_cluster_admin: userIsClusterAdmin(user),
        };
      });

    res.render('cluster-users', {
      cluster_admin: userIsClusterAdmin(req.user),
      can_create_notebooks: userCanCreateNotebooks(req.user),
      users: userListFiltered,
    });
  } else {
    res.status(401).end();
  }
});

if (DEVELOPER_MODE) {
  app.get('/restore/', requireClusterAdmin, async (req, res) => {
    if (req.user) {
      res.render('restore', {
        cluster_admin: userIsClusterAdmin(req.user),
        can_create_notebooks: userCanCreateNotebooks(req.user),
        developer: DEVELOPER_MODE,
      });
    } else {
      res.status(401).end();
    }
  });

  app.get('/notebooks/:id/validate', requireClusterAdmin, async (req, res) => {
    if (req.user) {
      const result = await validateProjectDatabase(req.params.id);
      res.json(result);
    }
  });
}

app.get('/up/', (req, res) => {
  res.status(200).json({up: 'true'});
});
