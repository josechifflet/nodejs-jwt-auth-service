import { NextFunction, Request, Response } from 'express';
import { AnyZodObject } from 'zod';

/**
 * Allows to perform a customized validation with zod.
 *
 * @param schema - Zod schema.
 * @returns Express Validation function callback.
 */
const validate =
  (schema: AnyZodObject) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    // Assign the parsed values to the request object
    req.body = parsed.body;
    req.query = parsed.query;
    req.params = parsed.params;

    return next();
  };

export default validate;
