/**
 * Configured express-zod-safe entrypoint.
 *
 * `setGlobalOptions` must run before any `validate({...})` call, because
 * missing-schema behaviour is captured when the middleware is created (at
 * route-module import time), not per-request. Importing validate from here
 * guarantees that ordering.
 *
 * express-zod-safe is a dual package: ESM exposes a named `setGlobalOptions`,
 * while CJS hangs it on `module.exports` (`export =` in the .d.ts). This package
 * typechecks/emits as CJS (`module: nodenext` without `"type": "module"`), so a
 * named ESM import fails tsc (TS2305). Loading via `createRequire` keeps one CJS
 * instance for both `validate` and `setGlobalOptions` (mixing ESM import with
 * CJS require would configure a different options object). `typeof import(...)`
 * preserves the validate overloads that narrow Express Request.
 */
import {createRequire} from 'node:module';
import path from 'node:path';
import type {NextFunction, Request, Response} from 'express';
import type {ZodError} from 'zod';

type ErrorListItem = {
  type: 'query' | 'params' | 'body';
  errors: ZodError;
};

type SetGlobalOptions = (options: {
  missingSchemaBehavior?: 'empty' | 'any';
  defaultSchemaObject?: 'strict' | 'lax';
  handler?: (
    errors: ErrorListItem[],
    req: Request,
    res: Response,
    next: NextFunction
  ) => void | Promise<void>;
}) => void;

/** Typed callable from the package (overloads that narrow Express Request). */
type ExpressZodSafe = typeof import('express-zod-safe');

type ValidateFn = ExpressZodSafe & {
  setGlobalOptions: SetGlobalOptions;
};

// tsc emit provides __filename; Vitest may run this file as ESM without it.
const nodeRequire = createRequire(
  typeof __filename !== 'undefined'
    ? __filename
    : path.join(process.cwd(), 'package.json')
);
const validate = nodeRequire('express-zod-safe') as ValidateFn;

validate.setGlobalOptions({
  // Default is 'empty': omitted params/query/body schemas become
  // z.strictObject({}), so e.g. validate({body}) rejects URL params.
  // 'any' skips validation for undeclared aspects (matches prior
  // processRequest behaviour).
  missingSchemaBehavior: 'any',
  // Default handler puts issues at `errors` directly and uses lowercase
  // type ('body'). We keep the capitalised envelope clients/tests read as
  // `body[0].errors.issues[...]` (Zod 4 ZodError JSON omits issues).
  handler: (errors, _req, res) => {
    res.status(400).send(
      errors.map(({type, errors: err}) => ({
        type: `${type[0]!.toUpperCase()}${type.slice(1)}` as
          | 'Query'
          | 'Params'
          | 'Body',
        errors: {
          name: err.name,
          message: err.message,
          issues: err.issues,
        },
      }))
    );
  },
});

export default validate;
