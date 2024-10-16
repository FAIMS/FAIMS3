// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {Request} from 'express';

declare global {
  namespace Express {
    interface Request {
      flash(type: string, message?: any): any;
      flash(type: string): any[];
      flash(): {[key: string]: any[]};
      session: any;
    }
  }
}
