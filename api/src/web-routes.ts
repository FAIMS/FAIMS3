import {NextFunction, Router} from 'express';
import passport from 'passport';
import {registerLocalUser} from './auth_providers/local';
import {generateUserToken} from './authkeys/create';

const PREFIX = '/web';

const protectedRoute = (req: any, res: any, next: NextFunction) => {
  if (!req.isAuthenticated()) return res.status(401).send('User not logged in');

  return next();
};

export function addWebRoutes(app: Router) {
  app.post(
    `${PREFIX}/login/local`,
    passport.authenticate('local'),
    async (req, res) => {
      const {user} = req;

      if (!user) {
        return res.status(400).send('Unknown error');
      }

      const {token} = await generateUserToken(user, false);

      if (!token) {
        return res.status(400).send('Error generating token');
      }

      return res.status(200).json({
        user: {
          id: user._id,
          name: user.name,
          email: user.emails[0],
        },
        token,
      });
    }
  );

  app.post(`${PREFIX}/signup/local`, async (req, res) => {
    const {
      body: {email, name, password},
    } = req;

    try {
      const [user, error] = await registerLocalUser(
        email,
        email,
        name,
        password
      );

      if (!user) return res.status(400).send(error);

      let loginError;

      req.login(user, (err: any) => {
        if (err) loginError = err;
      });

      if (loginError) return res.status(400).send(loginError);

      return res.status(200).json({
        user: {
          id: user._id,
          name: user.name,
        },
      });
    } catch (e) {
      return res.status(400).send(e);
    }
  });

  app.post(`${PREFIX}/logout`, protectedRoute, async (req, res) => {
    if (!req.user) return res.status(400).send('User not logged in');

    let logoutError;

    req.logout((err: any) => {
      if (err) logoutError = err;
    });

    if (logoutError) return res.status(400).send(logoutError);

    return res.status(200).send('Logged out');
  });
}
