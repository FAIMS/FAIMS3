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
 * Filename: core.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */

import cookieSession from 'cookie-session';
import cors from 'cors';
import express, {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response,
} from 'express';
import {ExpressHandlebars} from 'express-handlebars';
import RateLimit from 'express-rate-limit';
import handlebars from 'handlebars';
import morgan from 'morgan';
import passport from 'passport';
import flash from 'req-flash';

// use swaggerUI to display the UI documentation
// need this workaround to have the swagger-ui-dist package
// load our swagger.json rather than the petstore
// https://github.com/swagger-api/swagger-ui/issues/5710
const pathToSwaggerUi = require('swagger-ui-dist').getAbsoluteFSPath();

import {readFileSync} from 'fs';
import {join} from 'path';

const indexContent = readFileSync(
  join(pathToSwaggerUi, 'swagger-initializer.js')
)
  .toString()
  .replace('https://petstore.swagger.io/v2/swagger.json', '/swagger.json');

// Workaround done

import markdownit from 'markdown-it';
import {api as notebookApi} from './api/notebooks';
import {api as templatesApi} from './api/templates';
import {api as teamsApi} from './api/teams';
import {api as resetPasswordApi} from './api/emailReset';
import {api as usersApi} from './api/users';
import {api as utilityApi} from './api/utilities';
import {api as invitesApi} from './api/invites';
import {
  COOKIE_SECRET,
  RATE_LIMITER_ENABLED,
  RATE_LIMITER_PER_WINDOW,
  RATE_LIMITER_WINDOW_MS,
} from './buildconfig';
import patch from './utils/patchExpressAsync';

// This must occur before express app is used
patch();

export const app = express();
app.use(morgan('combined'));

const IS_TEST = process.env.NODE_ENV === 'test';

// Setup rate limiter
export const RATE_LIMITER = RateLimit({
  windowMs: RATE_LIMITER_WINDOW_MS,
  max: RATE_LIMITER_PER_WINDOW,
  message: 'Too many requests from this IP, please try again after 10 minutes',
  // Return rate limit info in the `RateLimit-*` headers
  standardHeaders: true,
  // Disable the `X-RateLimit-*` headers
  legacyHeaders: true,
});

if (!IS_TEST && RATE_LIMITER_ENABLED) {
  console.log('Activating rate limiter');
  app.use(RATE_LIMITER);
} else {
  if (IS_TEST) {
    console.log('Not enabling rate limiting due to being in test mode.');
  } else {
    console.log(
      'Not enabling rate limiting due to it being explicitly disabled.'
    );
  }
}

// Only parse query parameters into strings, not objects
app.set('query parser', 'simple');
app.use(
  cookieSession({
    name: 'session',
    secret: COOKIE_SECRET,
    maxAge: 24 * 60 * 60 * 1000 * 365, // BBS 20220831 changed to 1 year
  })
);
// https://github.com/jaredhanson/passport/issues/904
// register regenerate & save after the cookieSession middleware initialization
// fix for bug in passport 0.7.0 and compatibility with cookie-session
app.use((request, response, next) => {
  if (request.session && !request.session.regenerate) {
    request.session.regenerate = (cb: any) => {
      if (cb) cb('');
      return request.session;
    };
  }
  if (request.session && !request.session.save) {
    request.session.save = (cb: any) => {
      if (cb) cb('');
      return request.session;
    };
  }
  next();
});

const handlebarsConfig = {
  helpers: {
    markdown: (aString: string) => {
      let htmlText = markdownit().render(aString);
      // add the bootstrap table class to any tables
      htmlText = htmlText.replace(/<table>/g, '<table class="table">');
      return new handlebars.SafeString(htmlText);
    },
    and: (...args: any[]) => {
      // Remove the last argument (Handlebars options object)
      return args.slice(0, -1).every(Boolean);
    },
  },
};

const hbs = new ExpressHandlebars(handlebarsConfig);

app.use(express.urlencoded({extended: true}));
// allow large JSON objects to be posted
app.use(express.json({limit: '200mb'}));
app.use(cors());
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');
app.use(express.static('public'));
app.use('/api/notebooks', notebookApi);
app.use('/api/templates', templatesApi);
app.use('/api/teams', teamsApi);
app.use('/api/users', usersApi);
app.use('/api/reset', resetPasswordApi);
app.use('/api/invites', invitesApi);
app.use('/api', utilityApi);

// Custom error handler which returns a JSON description of error
// TODO specify this interface in data models
const errorHandler: ErrorRequestHandler = (
  err: Error & {status?: number},
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  // Set the response status code
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: {
      message: err.message,
      status: statusCode,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
};

// Use custom error handler which intercepts with JSON
app.use(errorHandler);

// Swagger-UI Routes
app.get('/apidoc/swagger-initializer.js', (req, res) => res.send(indexContent));
app.use('/apidoc/', express.static(pathToSwaggerUi));
