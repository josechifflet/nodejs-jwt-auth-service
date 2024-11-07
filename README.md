# Authentication as a Service

Secure API with OTP and Basic Authentication. Implemented as an API service express application in a unique use-case: attendance system.
Uses [RFC 7519](https://www.rfc-editor.org/rfc/rfc7519) for session based JSON Web Tokens (JWT).

## About

This project focus on creating a highly-secure auhtentication service API that conforms to OWASP Security Best Practices.

The flow of the API (Request - Response) is as follows:

```bash
Request -> Handler/Router -> Middleware (if applicable) -> Validations (if applicable) -> Controller -> Service -> Prisma (if applicable) / Cache (if applicable) -> Controller -> Response
```

- Four layer architecture: Validation and Controller, Service, and ORM (Prisma).
- Global error handler exist in the application. Every error(s) will be thrown to the global error handler to be 'handled'.
- We still have not yet used Dependency Injection for easier testability.

## Features

Below is the list of main features that this system have:

- Users can log in and register.
- Users can get their own authentication status.
- Users can forget and reset their own passwords.
- (**A**) Users can see their own profile, modify it (except password), and delete it.
- (**A**) Users can modify their own password.
- (**A**) Users can get all of their own sessions and can invalidate them if necessary.
- (**A**) Users can get their own attendance data.
- (**A**) Users can request OTP from the API via Email or Authenticator apps.
- (**A**) Users can receive a special MFA authorization by verifying the OTP.
- (**A C**) Users can update their own MFA secrets in Authenticator apps.
- (**A C**) Users can check in and check out their attendance.
- (**A B**) Admins can see all sessions and can invalidate them manually.
- (**A B C**) Admins can perform CRUD operations on the `User` entity.
- When set up, this system can remind people to log out at a certain time.
- System can send out notifications regarding security, such as password resets, sending invalid TOTP repeatedly, etcetera.
- The whole application is responsive and naturally supports HTTPS.
- OpenGraph tags are already set up for SEO purposes.

Legend:

- **A** means this feature/use-case requires authentication (user have to have a session).
- **B** means this feature/use-case requires a certain role (usually `admin`).
- **C** means this feature/use-case requires a MFA session (user have to have a JWS/JWT).

## Security

As this research focuses on creating a secure API, below are the considerations (white paper) that are taken during development:

- Users are divided into two roles: `admin` and `user` for clear separation of roles.
- A special kind of authorized session: `OTPSession`, using JSON Web Tokens (RFC 7519). Having this token means that the user is MFA authenticated. The JSON Web Tokens have a very small lifetime (only about 15 minutes). JSON Web Tokens are powered by `Ed25519` asymmetric algorithm.
- Sessions are stateless and managed as Bearer JSON Web Tokens (JWTs), signed with a secure, high-entropy session secret using the HS384 or EdDSA algorithm. Tokens contain standard claims (such as exp, iat, iss, and sub) to enforce secure, time-limited access and are refreshed upon authentication. JWTs are passed directly in the Authorization header with each request, eliminating the need for cookies, and can be manually managed by users through token issuance and revocation as needed.
- Passwords are hashed with `Argon2` algorithm. This means that passwords are not stored in plaintext and in an event the database is stolen, hackers would not be able to look at the plaintext passwords without the knowledge of the real passwords.
- The secret to generate the OTP is implemented with `nanoid` (it has high entropy and it is a cryptographically secure generator, taking its entropy from the system's hardware noise), and it is different for every other users in the system. Look at `cli/collision-test.ts` for tests.
- Conforms to RFC 6238 and RFC 7617 (Time-Based One-Time Passwords and Basic Authentication).
- OTP is time-based and it is generated with RFC 6238 algorithm with `SHA-1` hash function and a high-entropy secret (above). OTP is verified with the `userID` via RFC 7617 algorithm. OTPs are for one-time use only (in a certain timeframe).
- User identification generator is based on `uuidv4` algorithm for low-collision user IDs.
- Secure API protection middlewares (`helmet`, `hpp`, JSON-only API with a secure parser, slow downs, rate limiters, XST prevention, XSS prevention, and more).
- Secure API authorization (session authorization, role-based access control, MFA with JWT/JWS).
- API logging is performed using `morgan`, and complete request and response logging with `express-winston` and `winston` for audit purposes and debug purposes.
- API implementation conforms to JSON:API Standard and provides structured error messages and responses according to that standard.
- User can be banned by setting their `isActive` attribute to `false`. Banned users cannot access the API.
- No cheap tricks and 'unusual' security through obscurity (double encryption, triple encoding, multiple hashing, and the like). Cryptography/security is used to serve a specific purpose and be an effective solution for that purpose. Incorrect use of said concepts will make the system to be less secure.
- Emails are implemented with queue system (Bull) for performance and security.
- Rate limiters and slow downs exist in order to prevent spammers. It is implemented with Redis for persistence and performance.
- Body parser is implemented with a secure option, as it has a definitive limit and has a checker in the form of `Content-Type` and `Content-Length`.
- Prevent attacks like parameter pollution, payload too large, bad JSON, and many more with proper status codes.
- Implements secure authentiation flows: login, logout, registration, email verification, password updates, password forgots, password resets, session management, user management, and 2FA.
- Implements email notifications: on password resets, specific times without checking out, MFA session blocks after OTP failures, and more.
- All algorithms conforms to Kerckhoff's Principle: open design with the only secret being its key, and the key itself must not be able to be cracked should it fall in the hands of an attacker.
- Secure headers are placed in both API and Web. Examples: `Strict-Transport-Security` (HSTS), `Content-Security-Policy`, `X-XSS-Protection`, `X-Content-Type-Options`, and more.
- Powered by strong HTTPS ciphers, protected Linux processes, and a firewall (guidelines included).

## Standards

This application conforms to the following security standards:

- [OWASP ASVS](https://github.com/OWASP/ASVS) (Session Security, OTP Security)
- [OWASP WSTG: Authentication Testing](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/04-Authentication_Testing/README)
- [OWASP WSTG: Authorization Testing](https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/README)
- [OWASP API: Top 10 API Security](https://owasp.org/www-project-api-security/)
- [OWASP ZAP: Baseline](https://www.zaproxy.org/docs/docker/baseline-scan/)
- [Snyk: Dependencies and Code Security](https://snyk.io)
- [OWASP: Security Cheatsheets](https://cheatsheetseries.owasp.org/): Include but not limited to Authentication, Authorization, CSP, CSRF, Database, Forgot Password, MFA, Node.js, Password Storage, REST, and more.

To note, some error messages are made explicit ('code has been sent to your email if it exists in our database' vs 'code has been sent to your email') to the user because of usability concerns. A user would get annoyed if the system only provides an obscure error message that nobody can guess what is going on. It's always a trade off, and for this application, I'm leaning a bit towards the 'usability' part in terms of error messages.

## API Documentation

API documentation is available at Postman, and it is under construction for now. The whole codebase in this repository is completely typed and documented with TypeScript and JSDoc.

## Requirements (Development)

For development, you need the following technologies installed on your machine:

Stack:

- [Docker](https://www.docker.com/)
- [Postgres](https://www.postgresql.org/)
- [Redis](https://redis.io/)
- [Node.js 20+](https://nodejs.org/)
- [Yarn 1.22+](https://yarnpkg.com/)
- Unix-based systems or MacOS. 64-bit OS is recommended.

Application and Services:

- [Postman Desktop Agent](https://www.postman.com/downloads/) to test things locally
- [Mailtrap](https://mailtrap.io/) to test emails in development environment
- Authenticators, such as Google Authenticator, Microsoft Authenticator, etc.

## Credits

- [lauslim12](https://github.com/lauslim12). For his [attendance](https://github.com/lauslim12/attendance) project which was used as boilerplate to build this project.

## License

Application is licensed under MIT License. The research itself will follow the publisher's license after it has been published.
