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
import handlebars from 'handlebars';
import {body, validationResult} from 'express-validator';
import QRCode from 'qrcode';
import {app} from './core';
import {NonUniqueProjectID} from 'faims3-datamodel';
import {AllProjectRoles} from './datamodel/users';
import markdownit from 'markdown-it';

// BBS 20221101 Adding this as a proxy for the pouch db url
import {
  WEBAPP_PUBLIC_URL,
  IOS_APP_URL,
  ANDROID_APP_URL,
  CONDUCTOR_PUBLIC_URL,
  DEVELOPER_MODE,
  CONDUCTOR_AUTH_PROVIDERS,
} from './buildconfig';
import {
  requireAuthentication,
  requireClusterAdmin,
  requireNotebookMembership,
} from './middleware';
import {createInvite, getInvitesForNotebook} from './couchdb/invites';
import {
  getUserInfoForNotebook,
  getUsers,
  userCanCreateNotebooks,
  userHasPermission,
  userIsClusterAdmin,
} from './couchdb/users';
import {
  countRecordsInNotebook,
  getNotebookMetadata,
  getNotebookUISpec,
  getNotebooks,
  getRolesForNotebook,
} from './couchdb/notebooks';
import {getSigningKey} from './authkeys/signing_keys';
import {createAuthKey} from './authkeys/create';
import {getPublicUserDbURL} from './couchdb';
import {add_auth_providers} from './auth_providers';
import {add_auth_routes} from './auth_routes';

export {app};

add_auth_providers(CONDUCTOR_AUTH_PROVIDERS);
add_auth_routes(app, CONDUCTOR_AUTH_PROVIDERS);

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
  body('number').not().isEmpty(),
  body('role').not().isEmpty(),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('invite-error', {errors: errors.array()});
    }
    const project_id: NonUniqueProjectID = req.params.id;
    const role: string = req.body.role;
    const number: number = parseInt(req.body.number);

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
    } else {
      await createInvite(req.user as Express.User, project_id, role, number);
      res.redirect('/notebooks/' + project_id);
    }
  }
);

app.get('/notebooks/', requireAuthentication, async (req, res) => {
  const user = req.user;
  if (user) {
    const notebooks = await getNotebooks(user);
    res.render('notebooks', {
      user: user,
      notebooks: notebooks,
      cluster_admin: userIsClusterAdmin(user),
      can_create_notebooks: userCanCreateNotebooks(user),
      developer: DEVELOPER_MODE,
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
    const uiSpec = await getNotebookUISpec(project_id);
    const invitesQR: any[] = [];
    if (notebook && uiSpec) {
      const isAdmin = userHasPermission(user, project_id, 'modify');
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
        notebook: notebook,
        records: await countRecordsInNotebook(project_id),
        invites: invitesQR,
        views: Object.keys(uiSpec.viewsets),
        developer: DEVELOPER_MODE,
      });
    } else {
      res.sendStatus(404);
    }
  }
);

function make_html_safe(s: string): string {
  return handlebars.escapeExpression(s);
}

function render_project_roles(roles: AllProjectRoles): handlebars.SafeString {
  const all_project_sections = [];
  for (const project in roles) {
    const project_sections = [];
    for (const role of roles[project]) {
      project_sections.push('<li>' + make_html_safe(role) + '</li>');
    }
    const safe_name = make_html_safe(project);
    all_project_sections.push(
      '<h6>Roles for project "' +
        `<a href="./notebooks/${safe_name}/">` +
        safe_name +
        '</a>' +
        '"</h6>' +
        '<ul>' +
        project_sections.join('') +
        '</ul>'
    );
  }
  return new handlebars.SafeString(all_project_sections.join(''));
}

handlebars.registerHelper('markdown', aString => {
  let htmlText = markdownit().render(aString);
  // add the bootstrap table class to any tables
  htmlText = htmlText.replace(/<table>/g, '<table class="table">');
  return new handlebars.SafeString(htmlText);
});

app.get('/', async (req, res) => {
  if (req.user) {
    // Handlebars is pretty useless at including render logic in templates, just
    // parse the raw, pre-processed string in...
    const rendered_project_roles = render_project_roles(req.user.project_roles);
    const provider = Object.keys(req.user.profiles)[0];
    // BBS 20221101 Adding token to here so we can support copy from conductor
    const signing_key = await getSigningKey();
    const jwt_token = await createAuthKey(req.user, signing_key);
    const token = {
      jwt_token: jwt_token,
      public_key: signing_key.public_key_string,
      alg: signing_key.alg,
      userdb: getPublicUserDbURL(), // query: is this actually needed?
    };
    if (signing_key === null || signing_key === undefined) {
      res.status(500).send('Signing key not set up');
    } else {
      res.render('home', {
        user: req.user,
        token: Buffer.from(JSON.stringify(token)).toString('base64'),
        project_roles: rendered_project_roles,
        other_roles: req.user.other_roles,
        cluster_admin: userIsClusterAdmin(req.user),
        provider: provider,
        public_key: signing_key.public_key,
        developer: DEVELOPER_MODE,
      });
    }
  } else {
    res.redirect('/auth/');
  }
});

app.get('/logout/', (req, res, next) => {
  if (req.user) {
    req.logout(err => {
      if (err) {
        return next(err);
      }
    });
  }
  res.redirect('/');
});

app.get('/send-token/', (req, res) => {
  if (req.user) {
    res.render('send-token', {
      user: req.user,
      web_url: WEBAPP_PUBLIC_URL,
      android_url: ANDROID_APP_URL,
      ios_url: IOS_APP_URL,
    });
  } else {
    res.redirect('/');
  }
});

app.get('/get-token/', async (req, res) => {
  if (req.user) {
    const signing_key = await getSigningKey();
    if (signing_key === null || signing_key === undefined) {
      res.status(500).send('Signing key not set up');
    } else {
      const token = await createAuthKey(req.user, signing_key);

      res.send({
        token: token,
        pubkey: signing_key.public_key_string,
        pubalg: signing_key.alg,
      });
    }
  } else {
    res.status(403).end();
  }
  return;
});

app.get('/notebooks/:id/users', requireClusterAdmin, async (req, res) => {
  if (req.user) {
    const project_id = req.params.id;

    const notebook = await getNotebookMetadata(project_id);

    const userList = await getUserInfoForNotebook(project_id);
    res.render('users', {
      roles: userList.roles,
      users: userList.users,
      notebook: notebook,
    });
  } else {
    res.status(401).end();
  }
});

app.get('/users', requireClusterAdmin, async (req, res) => {
  if (req.user) {
    const id = req.user._id;
    const userList = await getUsers();
    res.render('cluster-users', {
      users: userList
        .filter(user => user._id !== id)
        .map(user => {
          return {
            username: user._id,
            name: user.name,
            is_cluster_admin: userIsClusterAdmin(user),
            can_create_notebooks: userCanCreateNotebooks(user),
          };
        }),
    });
  } else {
    res.status(401).end();
  }
});

if (DEVELOPER_MODE)
  app.get('/restore/', requireClusterAdmin, async (req, res) => {
    if (req.user) {
      res.render('restore');
    } else {
      res.status(401).end();
    }
  });

app.get('/up/', (req, res) => {
  res.status(200).json({up: 'true'});
});
