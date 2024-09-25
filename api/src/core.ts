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
import {api as usersApi} from './api/users';
import {api as utilityApi} from './api/utilities';
import {COOKIE_SECRET} from './buildconfig';

// See https://github.com/davidbanham/express-async-errors - this patches
// express to handle async errors without hanging or needing an explicit try
// catch block
require('express-async-errors');

export const app = express();
app.use(morgan('combined'));

// if (process.env.NODE_ENV !== 'test') {
//   // set up rate limiter: maximum of 30 requests per minute
//   const limiter = RateLimit({
//     windowMs: 1 * 60 * 1000, // 1 minute
//     max: 30,
//     validate: true,
//   });
//   app.use(limiter);
//   console.log('Rate limiter enabled');
// }

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
    request.session.regenerate = cb => {
      if (cb) cb('');
      return request.session;
    };
  }
  if (request.session && !request.session.save) {
    request.session.save = cb => {
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
app.use('/api', utilityApi);
app.use('/api/users', usersApi);

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
