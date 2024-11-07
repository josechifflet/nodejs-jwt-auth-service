import type { Request } from 'express';
import type { JWTHeaderParameters, JWTPayload, JWTVerifyOptions } from 'jose';
import { importPKCS8, importSPKI, jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

import config from '@/config';
import AppError from '@/util/app-error';

/**
 * Signs a JWT with HS256 (symmetric algorithm) for session-based authentication.
 * HS256 is a HMAC-based algorithm that uses a shared secret.
 *
 * @param jti - Unique identifier for the JWT, used to prevent token reuse (JWT ID).
 * @param sub - Subject of the JWT, typically the user ID.
 * @param expiration - Token expiration time in minutes.
 * @returns Signed JWT as a string.
 */
export const signHS256JWT = async (
  jti: string,
  sub: string,
  expiration: number,
) => {
  // Encode the shared secret for HS256 signing
  const secret = new TextEncoder().encode(config.JWT_SECRET);

  // Define the payload, including standard claims (RFC 7519) for JWTs
  const payload: JWTPayload = {
    aud: config.JWT_AUDIENCE, // Audience claim to identify the target audience
    exp: Math.floor(Date.now() / 1000) + expiration * 60, // Expiration claim in seconds
    iat: Math.floor(Date.now() / 1000), // Issued at claim for the token creation time
    iss: config.JWT_ISSUER, // Issuer claim identifying the principal that issued the token
    jti, // Unique JWT ID claim for the token
    nbf: Math.floor(Date.now() / 1000), // Not Before claim to specify when the token becomes valid
    sub, // Subject claim, generally the user ID
  };

  const headers: JWTHeaderParameters = {
    alg: 'HS256', // Specifies the algorithm used for the signature
    typ: 'JWT', // Declares the type as JWT
  };

  // Generate the signed JWT with the specified headers and payload
  return new SignJWT(payload).setProtectedHeader(headers).sign(secret);
};

/**
 * Signs a JWT using EdDSA (asymmetric algorithm) for scenarios requiring public-private key pairs.
 * EdDSA is an elliptic curve algorithm offering higher security and efficiency.
 *
 * @param jti - Unique identifier for the JWT, used to prevent token reuse.
 * @param sub - Subject of the JWT, typically the user ID.
 * @param expiration - Token expiration time in minutes.
 * @returns Signed JWT (JWS) as a string.
 */
export const signEdDSAJWT = async (
  jti: string,
  sub: string,
  expiration: number,
) => {
  // Import the private key for EdDSA signing
  const privateKey = await importPKCS8(config.JWT_PRIVATE_KEY, 'EdDSA');

  const payload: JWTPayload = {
    aud: config.JWT_AUDIENCE,
    exp: Math.floor(Date.now() / 1000) + expiration * 60,
    iat: Math.floor(Date.now() / 1000),
    iss: config.JWT_ISSUER,
    jti,
    nbf: Math.floor(Date.now() / 1000),
    sub,
  };

  const headers: JWTHeaderParameters = {
    alg: 'EdDSA', // Specifies EdDSA as the signing algorithm
    typ: 'JWT',
  };

  return new SignJWT(payload).setProtectedHeader(headers).sign(privateKey);
};

/**
 * Verifies a JWT using EdDSA (asymmetric algorithm) and decodes the payload.
 * Verifies that the token was issued by the expected issuer and intended for the audience.
 *
 * @param token - The JWT to verify.
 * @returns Decoded and verified JWT payload.
 * @throws AppError if verification fails.
 */
export const verifyEdDSAJWT = async (token: string) => {
  // Import the public key for verifying the JWT
  const publicKey = await importSPKI(config.JWT_PUBLIC_KEY, 'EdDSA');

  const options: JWTVerifyOptions = {
    audience: config.JWT_AUDIENCE, // Ensures the token is intended for the correct audience
    issuer: config.JWT_ISSUER, // Confirms the token's issuing authority
  };

  // Verify and decode the token, returning the JWT payload if valid
  return jwtVerify(token, publicKey, options);
};

/**
 * Extracts a JWT from the Authorization header in an Express request.
 * Assumes the format "Bearer <token>" for the Authorization header.
 *
 * @param req - Express.js request object.
 * @returns Extracted JWT as a string, or undefined if not present.
 */
export const extractJWTFromAuthHeader = (req: Request): string | undefined => {
  const { authorization } = req.headers;

  if (authorization?.startsWith('Bearer ')) {
    // Returns the JWT portion of the "Bearer <token>" format
    return authorization.split(' ')[1];
  }

  return undefined;
};

/**
 * Validates the JWT payload structure to ensure it meets RFC 7519 specifications.
 * Verifies that the payload contains required claims such as audience, expiration, and issuer.
 *
 * @param jwtPayload - The JWT payload to validate.
 * @returns The validated JWT payload object.
 * @throws AppError if the payload does not conform to RFC 7519.
 */
export const validateJWTPayload = (jwtPayload: JWTPayload) => {
  // Define the expected structure of the JWT payload
  const JWTPayloadSchema = z.object({
    aud: z.string(), // Audience claim
    exp: z.number(), // Expiration claim
    iat: z.number(), // Issued at claim
    iss: z.string(), // Issuer claim
    jti: z.string(), // JWT ID claim
    nbf: z.number(), // Not Before claim
    sub: z.string(), // Subject claim
  });

  // Validate the payload using Zod schema, throwing an error if invalid
  const validation = JWTPayloadSchema.safeParse(jwtPayload);
  if (!validation.success) {
    throw new AppError('Invalid JWT payload', 401);
  }

  return validation.data;
};
