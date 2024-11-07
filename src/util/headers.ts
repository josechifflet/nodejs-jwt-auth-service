import type { Request } from 'express';
import { z } from 'zod';

/**
 * Extracts a string value from a given header by parameter.
 *
 * @param req - Express.js's request object.
 * @returns Extracted value.
 */
export const extractHeader = (req: Request, header: string) => {
  const value = req.headers[header];
  const validatedHeader = z.string().safeParse(value);
  if (validatedHeader.success) return validatedHeader.data;

  return undefined;
};
