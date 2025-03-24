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
import {
  Action,
  NonUniqueProjectID,
  projectInviteToAction,
  Resource,
  Role,
  roleDetails,
  userCanDo,
  userHasGlobalRole,
  userHasResourceRole,
} from '@faims3/data-model';
import {body, validationResult} from 'express-validator';
import QRCode from 'qrcode';
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
import {app} from './core';
import {
  databaseValidityReport,
  initialiseDbAndKeys,
  verifyCouchDBConnection,
} from './couchdb';
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
} from './middleware';
import {processRequest} from 'zod-express-middleware';
import {z} from 'zod';

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
        cluster_admin: userHasGlobalRole({
          role: Role.GENERAL_ADMIN,
          user: req.user,
        }),
        can_create_notebooks: userCanDo({
          action: Action.CREATE_PROJECT,
          user: req.user,
        }),
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

// TODO add action for invite specifically
app.get(
  '/notebooks/:id/invite/',
  requireAuthentication,
  isAllowedToMiddleware({
    action: Action.READ_PROJECT_METADATA,
    getResourceId(req) {
      return req.params.id;
    },
  }),
  async (req, res) => {
    const notebook = await getNotebookMetadata(req.params.id);
    if (notebook) {
      res.render('invite', {
        notebook: notebook,
        roles: await getRolesForNotebook(),
      });
    } else {
      res.status(404).end();
    }
  }
);

app.post(
  '/notebooks/:projectId/invite/',
  requireAuthentication,
  // Ensure that the invite is for a valid role and that it relates to a project
  // resource specifically
  processRequest({
    params: z.object({projectId: z.string()}),
    body: z.object({
      role: z
        .nativeEnum(Role)
        .refine(v => roleDetails[v].resource === Resource.PROJECT),
    }),
  }),
  async ({params: {projectId}, body: {role}, user}, res) => {
    // Determine if the user can do this action
    const requiredAction = projectInviteToAction({role, action: 'create'});
    if (
      !user ||
      !userCanDo({action: requiredAction, user, resourceId: projectId})
    ) {
      res.render('invite-error', {
        errors: [
          {
            msg: `You do not have permission to invite users at this role level to this project ${projectId}`,
            location: 'header',
            param: 'user',
          },
        ],
      });
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
        can_create_notebooks: userHasGlobalRole({
          role: Role.GENERAL_CREATOR,
          user,
        }),
        developer: DEVELOPER_MODE,
        DESIGNER_URL: DESIGNER_URL,
      });
    } else {
      res.status(401).end();
    }
  }
);

app.get(
  '/notebooks/:notebook_id/',
  requireAuthentication,
  isAllowedToMiddleware({
    action: Action.READ_PROJECT_METADATA,
    getResourceId(req) {
      return req.params.notebook_id;
    },
  }),
  async (req, res) => {
    const user = req.user as Express.User; // requireAuthentication ensures user
    const project_id = req.params.notebook_id;
    const notebook = await getNotebookMetadata(project_id);
    const uiSpec = await getEncodedNotebookUISpec(project_id);
    const invitesQR: any[] = [];
    if (notebook && uiSpec) {
      const isAdmin = userHasResourceRole({
        user,
        resourceId: project_id,
        resourceRole: Role.PROJECT_ADMIN,
      });
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
        cluster_admin: userHasGlobalRole({role: Role.GENERAL_ADMIN, user}),
        can_create_notebooks: userHasGlobalRole({
          role: Role.GENERAL_CREATOR,
          user,
        }),
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

app.get(
  '/templates/',
  requireAuthentication,
  isAllowedToMiddleware({action: Action.VIEW_TEMPLATES}),
  async (req, res) => {
    const user = req.user!;
    const templates = await getTemplates();
    res.render('templates', {
      user: user,
      templates: templates,
      cluster_admin: userHasGlobalRole({role: Role.GENERAL_ADMIN, user}),
      can_create_notebooks: userHasGlobalRole({
        role: Role.GENERAL_CREATOR,
        user,
      }),
      developer: DEVELOPER_MODE,
    });
  }
);

app.get(
  '/templates/:template_id/',
  requireNotebookMembership,
  isAllowedToMiddleware({action: Action.CREATE_TEMPLATE}),
  async (req, res) => {
    const user = req.user!;
    const template_id = req.params.template_id;
    const template = await getTemplate(template_id);
    if (template) {
      res.render('template-landing', {
        user: user,
        cluster_admin: userHasGlobalRole({role: Role.GENERAL_ADMIN, user}),
        can_create_notebooks: userHasGlobalRole({
          role: Role.GENERAL_CREATOR,
          user,
        }),
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

app.get(
  '/notebooks/:id/users',
  requireAuthentication,
  isAllowedToMiddleware({action: Action.VIEW_USER_LIST}),
  processRequest({params: z.object({id: z.string().nonempty()})}),
  async (req, res) => {
    const projectId = req.params.id;
    const user = req.user!;
    const notebook = await getNotebookMetadata(projectId);
    const userList = await getUsersForResource({resourceId: projectId});

    res.render('users', {
      roles: getRolesForNotebook().map(r => r.role),
      users: userList,
      notebook: notebook,
      cluster_admin: userHasGlobalRole({role: Role.GENERAL_ADMIN, user}),
      can_create_notebooks: userHasGlobalRole({
        role: Role.GENERAL_CREATOR,
        user,
      }),
      developer: DEVELOPER_MODE,
    });
  }
);

app.get(
  '/users',
  requireAuthentication,
  isAllowedToMiddleware({action: Action.VIEW_USER_LIST}),
  async (req, res) => {
    const userList = await getUsers();
    const user = req.user!;
    const id = user._id;

    const userListFiltered = userList
      .filter(user => user._id !== id)
      .map(user => {
        return {
          username: user._id,
          name: user.name,
          cluster_admin: userHasGlobalRole({role: Role.GENERAL_ADMIN, user}),
          can_create_notebooks: userHasGlobalRole({
            role: Role.GENERAL_CREATOR,
            user,
          }),
        };
      });

    res.render('cluster-users', {
      users: userListFiltered,
      cluster_admin: userHasGlobalRole({role: Role.GENERAL_ADMIN, user}),
      can_create_notebooks: userHasGlobalRole({
        role: Role.GENERAL_CREATOR,
        user,
      }),
    });
  }
);

if (DEVELOPER_MODE) {
  app.get(
    '/restore/',
    requireAuthentication,
    isAllowedToMiddleware({action: Action.RESTORE_FROM_BACKUP}),
    async (req, res) => {
      const user = req.user!;
      res.render('restore', {
        cluster_admin: userHasGlobalRole({role: Role.GENERAL_ADMIN, user}),
        can_create_notebooks: userHasGlobalRole({
          role: Role.GENERAL_CREATOR,
          user,
        }),
        developer: DEVELOPER_MODE,
      });
    }
  );

  app.get(
    '/notebooks/:id/validate',
    requireAuthentication,
    isAllowedToMiddleware({action: Action.VALIDATE_DBS}),
    async (req, res) => {
      const result = await validateProjectDatabase(req.params.id);
      res.json(result);
    }
  );
}

app.get('/up/', (req, res) => {
  res.status(200).json({up: 'true'});
});
