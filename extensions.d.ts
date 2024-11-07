// JWT Payload interface.
interface JWTPayload {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  nbf: number;
  sub: string;
}

// Data from the user in the session.
interface AuthInfo {
  userPK: number;
  userID: string;
  tokenID: string;
  sessionPK: number;
  sessionID: string;
  lastActive: string;
  sessionInfo: {
    device: string;
    ip: string;
  };
  signedIn: string;
}

declare global {
  namespace Express {
    export interface Request {
      // Contains the Session JWT Payload.
      auth: JWTPayload;

      // Contains Data from the user in the session.
      session: AuthInfo;
    }
  }
}
// to make the file a module and avoid the TypeScript error
export {};
