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
 * Filename: src/auth_routes.ts
 * Description:
 *   This module exports the configuration of the build, including things like
 *   which server to use and whether to include test data
 */

import {
  AuthContextSchema,
  PeopleDBDocument,
  PostChangePasswordInput,
  PostChangePasswordInputSchema,
  PostForgotPasswordInputSchema,
  PostLoginInput,
  PostLoginInputSchema,
  PostRegisterInput,
  PostRegisterInputSchema,
  PostResetPasswordInput,
  PostResetPasswordInputSchema,
  PutLogoutInputSchema,
} from '@faims3/data-model';
import {NextFunction, Router} from 'express';
import passport from 'passport';
import {processRequest} from 'zod-express-middleware';
import {WEBAPP_PUBLIC_URL} from '../buildconfig';
import {
  createNewEmailCode,
  markCodeAsUsed,
  validateEmailCode,
} from '../couchdb/emailReset';
import {getTokenByToken, invalidateToken} from '../couchdb/refreshTokens';
import {
  getCouchUserFromEmailOrUserId,
  saveCouchUser,
  saveExpressUser,
  updateUserPassword,
} from '../couchdb/users';
import {createVerificationChallenge} from '../couchdb/verificationChallenges';
import {
  InternalSystemError,
  TooManyRequestsException,
  UnauthorizedException,
} from '../exceptions';
import {requireAuthenticationAPI} from '../middleware';
import {AuthAction, CustomSessionData} from '../types';
import {
  sendEmailVerificationChallenge,
  sendPasswordResetEmail,
} from '../utils/emailHelpers';
import patch from '../utils/patchExpressAsync';
import {
  buildQueryString,
  handleZodErrors,
  redirectWithToken,
  registerLocalUser,
  validateAndApplyInviteToUser,
  validateRedirect,
} from './helpers';
import {upgradeCouchUserToExpressUser} from './keySigning/create';
import {verifyUserCredentials} from './strategies/localStrategy';
import {RegisteredAuthProviders} from './strategies/applyStrategies';
import {Strategy as SamlStrategy} from 'passport-saml';

patch();

// This is the place to go if all else fails - it will have a token!
// note that this auth-return is not in this API but in the webapp
export const DEFAULT_REDIRECT_URL = WEBAPP_PUBLIC_URL + '/auth-return';

// Generate the URLs for auth and auth return for different auth providers
export const providerAuthUrl = (provider: string) => {
  return `/auth/${provider}`;
};
export const providerAuthReturnUrl = (provider: string) => {
  return `/auth-return/${provider}`;
};

// we will implement progressive delays on failed login attempts
const LOCKOUT_PERIOD_SHORT = 10 * 1000; // 10 seconds
const LOCKOUT_PERIOD_MEDIUM = 60 * 1000; // 1 minute
const LOCKOUT_PERIOD_LONG = 5 * 60 * 1000; // 5 minutes
const LOCKOUT_PERIOD_MAX = 15 * 60 * 1000; // 15 minutes (only after many attempts)

const LOCKOUT_THRESHOLD_STORE_SIZE = 100; // purge if we have more than this many entries to mitigate DDOS risk

// In-memory store of failed login attempts
interface FailedAttempt {
  count: number;
  lastAttempt: Date;
}
const failedLoginAttempts: Record<string, FailedAttempt> = {};

// Log a failed login attempt for a user
const logFailedLoginAttempt = async (username: string) => {
  // only log for known usernames
  const user = await getCouchUserFromEmailOrUserId(username);
  if (user) {
    if (!failedLoginAttempts[username]) {
      failedLoginAttempts[username] = {
        count: 1,
        lastAttempt: new Date(),
      };
    } else {
      failedLoginAttempts[username].count += 1;
      failedLoginAttempts[username].lastAttempt = new Date();
    }
  }
  // purge if we have lots of entries
  if (Object.keys(failedLoginAttempts).length > LOCKOUT_THRESHOLD_STORE_SIZE) {
    purgeLockoutStore();
  }
};
// reset the count once a user logs in successfully
const resetFailedLoginAttempts = (username: string) => {
  delete failedLoginAttempts[username];
};

// Calculate progressive delay based on failed attempt count
const getAccountLockoutDelay = (username: string): number => {
  const attempt = failedLoginAttempts[username];
  if (!attempt) return 0;

  const timeSinceLastAttempt =
    new Date().getTime() - attempt.lastAttempt.getTime();

  // Progressive delays - legitimate users can still eventually get through
  if (attempt.count >= 15) {
    // After 15 attempts: 15 minute delay
    const remaining = LOCKOUT_PERIOD_MAX - timeSinceLastAttempt;
    return remaining > 0 ? LOCKOUT_PERIOD_MAX : 0;
  } else if (attempt.count >= 10) {
    // After 10 attempts: 5 minute delay
    const remaining = LOCKOUT_PERIOD_LONG - timeSinceLastAttempt;
    return remaining > 0 ? LOCKOUT_PERIOD_LONG : 0;
  } else if (attempt.count >= 7) {
    // After 7 attempts: 1 minute delay
    const remaining = LOCKOUT_PERIOD_MEDIUM - timeSinceLastAttempt;
    return remaining > 0 ? LOCKOUT_PERIOD_MEDIUM : 0;
  } else if (attempt.count >= 5) {
    // After 5 attempts: 10 second delay
    const remaining = LOCKOUT_PERIOD_SHORT - timeSinceLastAttempt;
    return remaining > 0 ? LOCKOUT_PERIOD_SHORT : 0;
  }
  return 0; // No delay for first few attempts
};

// Check whether a user is locked out due to too many failed login attempts
const userIsLockedOut = (
  username: string,
  flash: (t: string, s: any) => void
): boolean => {
  // Only check account-based delays (not IP)
  const delayMs = getAccountLockoutDelay(username);
  if (delayMs > 0) {
    const delaySec = Math.ceil(delayMs / 1000);
    const delayMin = Math.ceil(delaySec / 60);

    const message =
      delaySec > 60
        ? `Too many failed login attempts. Please try again in ${delayMin} minute${delayMin > 1 ? 's' : ''}`
        : `Too many failed login attempts. Please try again in ${delaySec} second${delaySec > 1 ? 's' : ''}`;
    flash('error', {
      loginError: {msg: message},
    });
    return true;
  }
  return false;
};

// purge old entries from the failed login attempts store
const purgeLockoutStore = () => {
  const now = new Date().getTime();
  for (const username in failedLoginAttempts) {
    const attempt = failedLoginAttempts[username];
    // if last attempt was more than max lockout period ago, remove entry
    if (now - attempt.lastAttempt.getTime() > LOCKOUT_PERIOD_MAX) {
      delete failedLoginAttempts[username];
    }
  }
};

/**
 * Add authentication routes for local and federated login
 * The list of handlers are the ids of the configured federated handlers (eg. ['google'])
 * routes will be set up for each of these for auth and registration
 * See `auth_providers/index.ts` for registration of providers.
 *
 * @param app Express router
 * @param socialProviders configuration details for social login providers
 */
export function addAuthRoutes(
  app: Router,
  socialProviders: RegisteredAuthProviders | null
) {
  // For legacy versions of the app, we provide a message on /auth to
  // let them know they need to upgrade to the latest version
  app.get('/auth', (req, res) => {
    res.render('auth-legacy', {
      socialProviders,
    });
  });

  /**
   * Handle local login OR register request with username and password
   */
  app.post('/auth/local', async (req, res, next: NextFunction) => {
    // determine the action first
    const action = req.body.action as AuthAction;

    if (action === 'login') {
      // LOGIN
      // ========

      // parse the body as the login schema
      let loginPayload: PostLoginInput;

      const errorRedirect = `/login${buildQueryString({
        values: {
          inviteId: req.body.inviteId,
          redirect: req.body.redirect,
        },
      })}`;

      // If anything goes wrong - flash back to form fields
      try {
        loginPayload = PostLoginInputSchema.parse(req.body);
      } catch (validationError) {
        const handled = handleZodErrors({
          error: validationError,
          // type hacking here due to override not being picked up
          req: req as unknown as Request,
          res,
          formData: {email: req.body.email, name: req.body.name},
          redirect: errorRedirect,
        });
        if (!handled) {
          console.error('Auth error:', validationError);
          req.flash('error', 'An unexpected error occurred');
          res.status(500).redirect(errorRedirect);
          return;
        }
        return;
      }

      // Now we have a validated login payload - proceed

      // first check for lockout
      if (userIsLockedOut(loginPayload.email, req.flash)) {
        // we log this as a failed attempt to keep track of the most recent attempt
        await logFailedLoginAttempt(loginPayload.email);
        return res.redirect(errorRedirect);
      }

      // Are we redirecting?
      const {valid, redirect} = validateRedirect(
        loginPayload.redirect || DEFAULT_REDIRECT_URL
      );

      if (!valid) {
        return res.render('redirect-error', {redirect});
      }

      // Is there an invite present?
      const inviteId = loginPayload.inviteId;

      // Login with local passport strategy - catching the on success to apply
      // invite (if present) and redirect with token back to client
      // application (at redirect URL requested)
      return passport.authenticate(
        // local strategy (user/pass)
        'local',
        // do not use session (JWT only - no persistence)
        {session: false},
        // custom success function which signs JWT and redirects
        async (err: Error | null, user: Express.User, info: any) => {
          if (err) {
            req.flash('error', {
              loginError: {msg: err.message || 'Login failed'},
            });
            await logFailedLoginAttempt(req.body.email);
            return res.redirect(errorRedirect);
          }
          if (!user) {
            // if user is false, info might have something useful
            // the type of info is unconstrained (object | string | Array<string | undefined>)
            console.warn('User is false after local auth:', info);
            req.flash('error', {
              loginError: {msg: info?.message || 'Login failed'},
            });
            return res.redirect(errorRedirect);
          }
          // reset any failed login attempts
          resetFailedLoginAttempts(req.body.email);
          // We have logged in - do we also want to consume an invite?
          if (inviteId) {
            // We have an invite to consume - go ahead and use it
            await validateAndApplyInviteToUser({
              inviteCode: inviteId,
              dbUser: user,
            });
            // avoid saving unwanted details here
            await saveExpressUser(user);
          }
          // Always upgrade prior to returning token to ensure we have latest!

          // token
          return redirectWithToken({
            res,
            user: await upgradeCouchUserToExpressUser({dbUser: user}),
            redirect,
          });
        }
      )(req, res, next);
    } else if (action === 'register') {
      // REGISTER
      // ========

      // parse the body as the login schema
      let registerPayload: PostRegisterInput;

      const errorRedirect = `/register${buildQueryString({
        values: {
          inviteId: req.body.inviteId,
          redirect: req.body.redirect,
        },
      })}`;

      // If anything goes wrong - flash back to form fields
      try {
        registerPayload = PostRegisterInputSchema.parse(req.body);
      } catch (validationError) {
        const handled = handleZodErrors({
          error: validationError,
          // type hacking here due to override not being picked up
          req: req as unknown as Request,
          res,
          formData: {email: req.body.email, name: req.body.name},
          redirect: errorRedirect,
        });
        if (!handled) {
          req.flash('error', 'An unexpected error occurred');
          res.status(500).redirect(errorRedirect);
          return;
        }
        return;
      }

      // Now we have a validated register payload - proceed

      // Are we redirecting?
      const {valid, redirect} = validateRedirect(
        registerPayload.redirect || DEFAULT_REDIRECT_URL
      );

      if (!valid) {
        return res.render('redirect-error', {redirect});
      }

      // Is there an invite present?
      const inviteId = registerPayload.inviteId;

      if (!inviteId) {
        // 400 error as this is an invalid request
        res.status(400);
        req.flash('error', {
          registrationError: {msg: 'No invite provided for registration.'},
        });
        // go back to auth homepage
        res.redirect('/auth');
        return;
      }

      // Check our payload for required fields
      const password = registerPayload.password;
      const repeat = registerPayload.repeat;
      const name = registerPayload.name;
      const email = registerPayload.email;

      if (password !== repeat) {
        req.flash('error', {
          repeat: {msg: "Password and repeat don't match."},
        });
        req.flash('email', email);
        req.flash('name', name);
        res.status(400);

        // This is the registration page - let's go back with full auth
        // context
        res.redirect(errorRedirect);
        return;
      }

      // Build the user creation hook which will run once the invite is
      // accepted and consumed
      const createUser = async () => {
        // this will throw if the user already exists
        const [user, error] = await registerLocalUser(
          // Email is used as username
          {username: email, email, name, password}
        );
        if (!user) {
          req.flash('error', {registrationError: {msg: error}});
          req.flash('email', email);
          req.flash('name', name);
          res.status(400);
          res.redirect(errorRedirect);
          throw Error(
            'User could not be created due to an issue writing to the database!'
          );
        }

        // Here we send a verification challenge email(s)
        for (const emailDetails of user.emails) {
          if (!emailDetails.verified) {
            createVerificationChallenge({
              userId: user._id,
              email: emailDetails.email,
            }).then(challenge => {
              return sendEmailVerificationChallenge({
                recipientEmail: emailDetails.email,
                username: user._id,
                verificationCode: challenge.code,
                expiryTimestampMs: challenge.record.expiryTimestampMs,
              });
            });
          }
        }
        return user;
      };

      // Do we have an existing user if so - reuse our login behaviour instead!
      // (This checks the password is correct)
      if (await getCouchUserFromEmailOrUserId(email)) {
        return passport.authenticate(
          // local strategy (user/pass)
          'local',
          // do not use session (JWT only - no persistence)
          {session: false},
          // custom success function which signs JWT and redirects
          async (err: string | Error | null, user: Express.User, info: any) => {
            if (err) {
              req.flash('error', {registrationError: {msg: err.toString()}});
              return res.redirect(errorRedirect);
            }
            if (!user) {
              // if user is false, info might have something useful
              // the type of info is unconstrained (object | string | Array<string | undefined>) but
              // from OIDC we get {message: '...'} with an error message on failure
              // I think they don't use err here because this is a post-auth failure
              // (the case I saw was mis-configuration of the endpoint)
              console.warn('User is false after social auth:', info);
              req.flash('error', {
                registrationError: {msg: info?.message || 'Login failed'},
              });
              return res.redirect(errorRedirect);
            }
            // We have logged in - do we also want to consume an invite?
            if (inviteId) {
              // We have an invite to consume - go ahead and use it
              await validateAndApplyInviteToUser({
                inviteCode: inviteId,
                dbUser: user,
              });
              // avoid saving unwanted details here
              await saveExpressUser(user);
            }
            // No longer login user with session - now redirect straight back with
            // token
            return redirectWithToken({
              res,
              user: await upgradeCouchUserToExpressUser({dbUser: user}),
              redirect,
            });
          }
        )(req, res, next);
      }

      let createdDbUser: PeopleDBDocument;
      try {
        createdDbUser = await validateAndApplyInviteToUser({
          // We don't have this yet
          dbUser: undefined,
          // instead we generate it once invite is OK
          createUser,
          // Pass in the invite - it's all validated
          inviteCode: inviteId,
        });
        await saveCouchUser(createdDbUser);
      } catch (e) {
        res.status(400);
        req.flash('error', {
          registrationError: {
            msg: 'Invite is not valid for registration! Is it expired, or has been used too many times?',
          },
        });
        res.redirect(errorRedirect);
        return;
      }

      req.flash('message', 'Registration successful');

      // Upgrade to express.User by drilling permissions/associations
      const expressUser = await upgradeCouchUserToExpressUser({
        dbUser: createdDbUser,
      });

      return redirectWithToken({
        res,
        user: expressUser,
        redirect,
      });
    }
  });

  /**
   * Handle password change for local users
   */
  app.post('/auth/changePassword', async (req, res) => {
    // Parse the body of the payload - we do this here so we can flash err messages
    let payload: PostChangePasswordInput = req.body;
    const errRedirect = `/change-password${buildQueryString({values: {username: payload.username, redirect: payload.redirect}})}`;

    // If anything goes wrong - flash back to form fields
    try {
      payload = PostChangePasswordInputSchema.parse(req.body);
    } catch (validationError) {
      const handled = handleZodErrors({
        error: validationError,
        // type hacking here due to override not being picked up
        req: req as unknown as Request,
        res,
        formData: {},
        redirect: errRedirect,
      });
      if (!handled) {
        req.flash('error', {
          changePasswordError: {msg: 'An unexpected error occurred'},
        });
        res.status(500).redirect(errRedirect);
        return;
      }
      return;
    }

    // We now have a validated payload
    const {username, currentPassword, newPassword, confirmPassword, redirect} =
      payload;

    // Validate the redirect URL
    const {valid, redirect: validatedRedirect} = validateRedirect(
      redirect || DEFAULT_REDIRECT_URL
    );

    if (!valid) {
      return res.render('redirect-error', {redirect: validatedRedirect});
    }

    // Check if passwords match
    if (newPassword !== confirmPassword) {
      req.flash('error', {
        changePasswordError: {msg: 'New passwords do not match'},
      });
      return res.redirect(errRedirect);
    }

    try {
      // Verify current password using our standalone verification function
      const verificationResult = await verifyUserCredentials({
        username,
        password: currentPassword,
      });

      if (!verificationResult.success) {
        req.flash('error', {
          currentPassword: {
            msg: verificationResult.error || 'Password incorrect.',
          },
        });
        return res.redirect(errRedirect);
      }

      const dbUser = verificationResult.user;
      if (!dbUser) {
        req.flash('error', {
          changePasswordError: {msg: 'Failed to change password.'},
        });
        return res.redirect(errRedirect);
      }

      // Check the db user has a local profile
      if (!dbUser.profiles.local) {
        req.flash('error', {
          changePasswordError: {
            msg: 'You are trying to change the password of a social provider account!',
          },
        });
        return res.redirect(errRedirect);
      }

      // Apply change (this also saves)
      await updateUserPassword(username, newPassword);

      // Flash success message and redirect
      req.flash('success', 'Password changed successfully');
      return res.redirect(validatedRedirect);
    } catch (error) {
      console.error('Password change error:', error);
      req.flash('error', {
        changePasswordError: {
          msg: 'An error occurred while changing password. Contact a system administrator.',
        },
      });
      return res.redirect(errRedirect);
    }
  });

  /**
   * PUT Logout - logging out is an optional client 'good will' process in which
   * the client indicates they wish for the specific refresh token to be
   * invalidated.
   */
  app.put(
    '/auth/logout',
    requireAuthenticationAPI,
    processRequest({
      body: PutLogoutInputSchema,
    }),
    async ({user, body: {refreshToken}}, res) => {
      if (!user) {
        throw new UnauthorizedException();
      }

      // token
      const refresh = await getTokenByToken(refreshToken);

      if (!refresh) {
        // It's fine - just let client think logout succeeded- this refresh
        // token is invalid anyway
        return res.sendStatus(200);
      }

      // User's should not be able to disable other people's token - but let's
      // not give info here - just return 200
      if (refresh.userId !== user._id) {
        return res.sendStatus(200);
      }

      try {
        await invalidateToken(refreshToken);
      } catch (e) {
        console.error('Invalidation of token failed unexpectedly. Error: ', e);
        throw new InternalSystemError(
          'Unexpected failure to invalidate token.'
        );
      }

      // job done
      return res.sendStatus(200);
    }
  );

  /*
   * Handle forgot password requests
   * Generates a password reset code and sends an email to the user
   * Includes rate limiting to prevent abuse
   */
  app.post(
    '/auth/forgotPassword',
    processRequest({
      body: PostForgotPasswordInputSchema,
    }),
    async (req, res) => {
      const {email, redirect} = req.body;

      // Validate the redirect URL
      const {valid, redirect: validatedRedirect} = validateRedirect(
        redirect || DEFAULT_REDIRECT_URL
      );

      if (!valid) {
        return res.render('redirect-error', {redirect: validatedRedirect});
      }

      const errRedirect = `/forgot-password${buildQueryString({
        values: {redirect: validatedRedirect},
      })}`;

      try {
        // Get the user by email
        const user = await getCouchUserFromEmailOrUserId(email);

        if (!user) {
          // For security reasons, don't reveal if the email exists or not
          // Just show the success page as if we sent the email
          req.flash(
            'success',
            'If an account exists with that email, you will receive password reset instructions shortly.'
          );
          return res.redirect(errRedirect);
        }

        // Check if the user has a local profile
        if (!user.profiles.local) {
          req.flash('error', {
            forgotPasswordError: {
              msg: 'This account uses social login. Please sign in with your social provider instead.',
            },
          });
          return res.redirect(errRedirect);
        }

        try {
          // Generate reset code with email and purpose for rate limiting
          const {code, record} = await createNewEmailCode({
            userId: user.user_id,
          });

          // Send the password reset email. We don't await to keep response fast.
          sendPasswordResetEmail({
            recipientEmail: email,
            username: user.name || user.user_id,
            resetCode: code,
            expiryTimestampMs: record.expiryTimestampMs,
            redirect: validatedRedirect,
          });

          // Flash success message
          req.flash(
            'success',
            'If an account exists with that email, you will receive password reset instructions shortly.'
          );
        } catch (error) {
          if (error instanceof TooManyRequestsException) {
            req.flash('error', {
              forgotPasswordError: {
                msg: 'Too many password reset attempts.',
              },
            });
          } else {
            // For other errors, log but don't reveal details to user
            console.error('Password reset error:', error);
            req.flash('error', {
              forgotPasswordError: {
                msg: 'An error occurred while processing your request. Please try again later.',
              },
            });
          }
        }

        return res.redirect(errRedirect);
      } catch (error) {
        console.error('Password reset error:', error);
        req.flash('error', {
          forgotPasswordError: {
            msg: 'An error occurred while processing your request. Please try again later.',
          },
        });
        return res.redirect(errRedirect);
      }
    }
  );

  /**
   * Handle password reset submissions
   */
  app.post('/auth/resetPassword', async (req, res) => {
    // Get redirect and code for error handling redirects
    const code = req.body.code;
    let payload: PostResetPasswordInput = req.body;
    const redirect = payload.redirect || DEFAULT_REDIRECT_URL;

    // Validate the redirect URL
    const {valid, redirect: validatedRedirect} = validateRedirect(redirect);

    if (!valid) {
      return res.render('redirect-error', {redirect: validatedRedirect});
    }

    // Create the error redirect URL
    const errRedirect = `/auth/reset-password${buildQueryString({
      values: {code, redirect: validatedRedirect},
    })}`;

    // Parse and validate the request body
    try {
      payload = PostResetPasswordInputSchema.parse(req.body);
    } catch (validationError) {
      const handled = handleZodErrors({
        error: validationError,
        req: req as unknown as Request,
        res,
        formData: {}, // No form data to preserve
        redirect: errRedirect,
      });

      if (!handled) {
        console.error('Reset password validation error:', validationError);
        req.flash('error', {
          resetPasswordError: {
            msg: 'An unexpected error occurred during validation',
          },
        });
        res.status(500).redirect(errRedirect);
      }
      return;
    }

    try {
      // Validate the reset code
      const validationResult = await validateEmailCode(payload.code);

      if (!validationResult.valid || !validationResult.user) {
        req.flash('error', {
          resetPasswordError: {
            msg: validationResult.validationError || 'Invalid reset code.',
          },
        });
        return res.redirect(errRedirect);
      }

      // Update the user's password
      await updateUserPassword(
        validationResult.user.user_id,
        payload.newPassword
      );

      // Mark the code as used
      await markCodeAsUsed(payload.code);

      // Flash success message and redirect to login page
      req.flash(
        'success',
        'Your password has been successfully reset. You can now log in with your new password.'
      );

      // Redirect to login page with the original redirect parameter
      return res.redirect(
        `/login${buildQueryString({
          values: {redirect: validatedRedirect},
        })}`
      );
    } catch (error) {
      console.error('Password reset error:', error);
      req.flash('error', {
        resetPasswordError: {
          msg: 'An error occurred while resetting your password. Please try again.',
        },
      });
      return res.redirect(errRedirect);
    }
  });

  // For each handler, deploy an auth route + auth return route
  for (const provider in socialProviders) {
    const handlerDetails = socialProviders[provider].config;
    const handlerStrategy = socialProviders[provider].strategy;

    if (handlerDetails.type === 'saml') {
      // Get the strategy instance from passport
      const strategy = handlerStrategy as SamlStrategy;

      // Metadata endpoint
      app.get(`/auth/${provider}/metadata`, (req, res) => {
        res.type('application/xml');
        res.send(
          strategy.generateServiceProviderMetadata(
            // Decryption cert: IdP uses this to encrypt assertions sent to us
            // Only include if we're set up to decrypt
            handlerDetails.enableDecryptionPvk
              ? (handlerDetails.publicKey ?? null)
              : null,
            // Signing cert: IdP uses this to verify requests we sign
            // Only include if we have a private key for signing
            handlerDetails.privateKey
              ? (handlerDetails.publicKey ?? null)
              : null
          )
        );
      });
    }

    // **Login OR register** method for this handler - this will result in a
    // redirection to the configured providers URL, then called back to the
    // configured callback (see below)
    app.get(
      providerAuthUrl(provider),
      processRequest({
        query: AuthContextSchema,
      }),

      /**
       * The purpose of this handler is to store necessary information into the
       * session before passport manages the redirection off to the provider.
       * The callback function will then be called (below).
       */
      (req, res, next) => {
        // pull out session data
        const sessionData = req.session as CustomSessionData;

        // Are we redirecting?
        const {valid, redirect} = validateRedirect(
          req.query.redirect || DEFAULT_REDIRECT_URL
        );

        if (!valid) {
          return res.render('redirect-error', {redirect});
        }
        const inviteId = req.query.inviteId;
        const action = req.query.action;

        // Store into session (we are about to be redirected! Bye bye)
        sessionData.redirect = redirect;
        if (inviteId) sessionData.inviteId = inviteId;
        if (action) sessionData.action = action;

        // passport authenticate route for this handler (bye bye)
        passport.authenticate(provider, {scope: handlerDetails.scope})(
          req,
          res,
          next
        );
      }
    );

    // the callback URL for this provider - all we need to do is call the
    // validate function again since we will have come back with enough info now
    // NOTE: we accept all methods because some protocols e.g. SAML use POST
    app.all(providerAuthReturnUrl(provider), (req, res, next) => {
      // we expect these values! (Or some of them e.g. invite may not be
      // present)
      const redirectValues = {
        inviteId: (req.session as CustomSessionData).inviteId,
        redirect: (req.session as CustomSessionData).redirect,
        action: (req.session as CustomSessionData).action,
      };
      const loginErrorRedirect = `/login${buildQueryString({
        values: redirectValues,
      })}`;
      const registerErrorRedirect = `/register${buildQueryString({
        values: redirectValues,
      })}`;
      // authenticate using the associated validate function
      passport.authenticate(
        provider,
        // custom success function which signs JWT and redirects
        async (err: Error | null, user: Express.User, info: any) => {
          // We have come back from EITHER login or registration. In either case
          // we have either a newly minted user, or an updated existing one -
          // now we just apply an invite if present

          // firstly throw error if needed (flash it out and redirect to the
          // right place returning with full context for another attempt)
          if (err) {
            if ((req.session as CustomSessionData).action === 'login') {
              req.flash('error', {loginError: {msg: err.message}});
              return res.redirect(loginErrorRedirect);
            } else {
              req.flash('error', {registrationError: {msg: err.message}});
              return res.redirect(registerErrorRedirect);
            }
          }
          if (!user) {
            // if user is false, info might have something useful
            // the type of info is unconstrained (object | string | Array<string | undefined>) but
            // from OIDC we get {message: '...'} with an error message on failure
            // I think they don't use err here because this is a post-auth failure
            // (the case I saw was mis-configuration of the endpoint)
            console.warn('User is false after social auth:', info);
            req.flash('error', {
              registrationError: {msg: info?.message || 'Login failed'},
            });
            return res.redirect(registerErrorRedirect);
          }
          const inviteId = (req.session as CustomSessionData).inviteId;
          const updatedUser = user;
          if (inviteId) {
            // apply invite
            const updatedUser = await validateAndApplyInviteToUser({
              inviteCode: inviteId,
              dbUser: user,
            });
            // save
            await saveCouchUser(updatedUser);
          }

          // Are we redirecting?
          const {valid, redirect} = validateRedirect(
            (req.session as CustomSessionData)?.redirect || DEFAULT_REDIRECT_URL
          );

          if (!valid) {
            return res.render('redirect-error', {redirect});
          }

          return redirectWithToken({
            res,
            user: await upgradeCouchUserToExpressUser({dbUser: updatedUser}),
            redirect,
          });
        }
      )(req, res, next);
    });
  }
}
