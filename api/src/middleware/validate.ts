/**
 * Configured express-zod-safe entrypoint.
 *
 * `setGlobalOptions` must run before any `validate({...})` call, because
 * missing-schema behaviour is captured when the middleware is created (at
 * route-module import time), not per-request. Importing validate from here
 * guarantees that ordering.
 */
import validate, {setGlobalOptions} from 'express-zod-safe';

setGlobalOptions({
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
