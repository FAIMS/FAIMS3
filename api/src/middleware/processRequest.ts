/**
 * Zod 4–compatible request processor.
 *
 * `zod-express-middleware@1.4` was written for Zod 3; with Zod 4 its generics no
 * longer infer schema output onto `req.params` / `req.query` / `req.body`, so
 * handlers see Express `ParsedQs` / `ParamsDictionary` instead. This thin
 * wrapper keeps the same runtime behaviour while restoring typed inference.
 */
import type {NextFunction, Request, RequestHandler, Response} from 'express';
import type {ZodType} from 'zod';
import {ZodError} from 'zod';

type RequestSchemas<TParams, TQuery, TBody> = {
  params?: ZodType<TParams>;
  query?: ZodType<TQuery>;
  body?: ZodType<TBody>;
};

type ErrorListItem = {
  type: 'Query' | 'Params' | 'Body';
  errors: ZodError;
};

function sendErrors(errors: ErrorListItem[], res: Response): void {
  // Zod 4's ZodError only JSON-serialises `name`/`message` (issues are lost).
  // Emit an object with an explicit `issues` array so clients/tests can read
  // `body[0].errors.issues[...]` the same way as under Zod 3.
  res.status(400).send(
    errors.map(({type, errors: err}) => ({
      type,
      errors: {
        name: err.name,
        message: err.message,
        issues: err.issues,
      },
    }))
  );
}

export function processRequest<
  TParams = Record<string, string>,
  TQuery = unknown,
  TBody = unknown,
>(
  schemas: RequestSchemas<TParams, TQuery, TBody>
): RequestHandler<TParams, any, TBody, TQuery> {
  return (req, res, next) => {
    const errors: ErrorListItem[] = [];

    if (schemas.params) {
      const parsed = schemas.params.safeParse(req.params);
      if (parsed.success) {
        (req as Request).params = parsed.data as Request['params'];
      } else {
        errors.push({type: 'Params', errors: parsed.error});
      }
    }

    if (schemas.query) {
      const parsed = schemas.query.safeParse(req.query);
      if (parsed.success) {
        (req as Request).query = parsed.data as Request['query'];
      } else {
        errors.push({type: 'Query', errors: parsed.error});
      }
    }

    if (schemas.body) {
      const parsed = schemas.body.safeParse(req.body);
      if (parsed.success) {
        (req as Request).body = parsed.data;
      } else {
        errors.push({type: 'Body', errors: parsed.error});
      }
    }

    if (errors.length > 0) {
      sendErrors(errors, res);
      return;
    }

    return next();
  };
}

/** Convenience re-export so call sites can keep a single import path. */
export type {NextFunction, Request, Response};
