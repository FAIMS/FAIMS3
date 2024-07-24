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

import express from 'express';
import cookieSession from 'cookie-session';
import cors from 'cors';
import passport from 'passport';
import morgan from 'morgan';
import {engine as express_handlebars} from 'express-handlebars';
import RateLimit from 'express-rate-limit';
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

import {COOKIE_SECRET} from './buildconfig';
import {api} from './api/routes';

export const app = express();
app.use(morgan('combined'));

if (process.env.NODE_ENV !== 'test') {
  // set up rate limiter: maximum of 30 requests per minute
  const limiter = RateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30,
    validate: true,
  });
  app.use(limiter);
  console.log('Rate limiter enabled');
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

app.use(express.urlencoded({extended: true}));
// allow large JSON objects to be posted
app.use(express.json({limit: '200mb'}));
app.use(cors());
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.engine('handlebars', express_handlebars());
app.set('view engine', 'handlebars');
app.use(express.static('public'));
app.use('/api', api);

// Swagger-UI Routes
app.get('/apidoc/swagger-initializer.js', (req, res) => res.send(indexContent));
app.use('/apidoc/', express.static(pathToSwaggerUi));
