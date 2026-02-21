## HerGuardian Backend

Node.js/Express backend for HerGuardian: authentication, profiles, emergency contacts, addresses, safety timers, SOS alerts, and smartwatch ingestion. Uses Prisma Client with MongoDB, Zod validation, JWT cookies, and production hardening (Helmet, Compression, CORS allowlist).

### Tech Stack

- Node.js (ESM), Express 5
- Prisma Client + MongoDB
- JWT auth (access + refresh) with HttpOnly cookies
- Socket.io for chatbot events
- Zod for validation
- Nodemailer for email
- Helmet, Compression, CORS allowlist, Morgan (dev)
- Jest + Supertest tests, GitHub Actions CI

### Quick Start

1. Install dependencies

```
npm ci
```

2. Generate Prisma client

```
npx prisma generate
```

3. Set environment variables (see .env.example below)
4. Run locally

```
npm run dev
```

Server listens on `PORT` (default 5000). Health check: `GET /healthz` (200 OK).

### Environment Variables

Set these in your environment or `.env` (not committed):

- `DATABASE_URL` MongoDB connection string
- `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` strong secrets
- `ACCESS_TOKEN_EXPIRY` default `1d`
- `REFRESH_TOKEN_EXPIRY` default `7d`
- `FRONTEND_URL` single allowed origin (e.g., `http://localhost:3000`)
- `CORS_ORIGINS` comma-separated origins (overrides single origin)
- `PORT`, `NODE_ENV`

Cookies across different domains: set `FRONTEND_URL/CORS_ORIGINS` appropriately and ensure HTTPS in production.

### NPM Scripts

```
npm run dev           # start with nodemon
npm start             # start in production
npm run studio        # Prisma Studio
npm run migrate       # prisma migrate dev
npm run seed          # seed sample data
npm test              # run tests
npm run test:watch    # watch tests
```

### Testing

Jest + Supertest with ESM.

```
npm test
# with coverage
npm test -- --coverage
```

Coverage thresholds are enforced in `jest.config.js`.

### Seeding

Populate sample users, addresses, contacts, timers, and SOS logs:

```
npm run seed
```

Requires a valid `DATABASE_URL` to be set.

### Production Hardening

- Helmet + Compression enabled
- CORS allowlist via `FRONTEND_URL` or `CORS_ORIGINS`
- `trust proxy` and `x-powered-by` disabled
- Graceful shutdown with Prisma disconnect on SIGINT/SIGTERM
- Health check endpoint: `/healthz`

### Deployment

1. Provision MongoDB (e.g., Atlas) and set `DATABASE_URL`
2. Set all env vars in your host
3. Build and start

```
npm ci
npx prisma generate
npm start
```

Recommended: run behind Nginx/ALB with HTTPS, or use PM2/Docker. Configure your LB to check `GET /healthz`.

### API Overview (high level)

- Auth: `POST /users/register`, `POST /users/login`, `POST /users/logout`, `POST /users/refresh-token`, `PATCH /users/onboard`
- User: `GET /users/profile`, `PATCH /users/update-stealth`, `POST /users/sos-trigger`, `GET /users/get-sos-logs`
- Contacts: `POST /contacts/create-contacts`, `POST /contacts/add-single-contact`, `GET /contacts/get-all-contacts`, `PATCH /contacts/update-emergency-contact`, `DELETE /contacts/delete-contact`
- Address: `POST /address/create-address`, `GET /address/get-all-addresses`, `PATCH /address/update-address`, `DELETE /address/delete-address`
- Timer: `POST /timer/start`, `PATCH /timer/cancel`
- Watch: `POST /watch/data`
- Socket.io: see `routes/chatbotRoutes.js`

### Conventions

- ESM imports (`type: module`)
- Validation via Zod middleware
- Async handlers wrapped to route errors to the global error handler

### License

ISC (see `package.json`).

### Session & Token Strategy (Updated)

The authentication system uses short‑lived access tokens and rotating refresh tokens with optional long-lived sliding sessions when `rememberMe=true`.

Access Token:

- Lifetime: default 15 minutes (`ACCESS_TOKEN_EXPIRY`, fallback `15m`).
- Delivered as HttpOnly cookie `accessToken` (Secure + SameSite=Strict in production).
- Not stored in localStorage; Authorization header is set in-memory on the frontend when available.

Refresh Token:

- Short session (rememberMe = false): default 2 hours (`REFRESH_TOKEN_SHORT_EXPIRY`, fallback `2h`).
- Long session (rememberMe = true): default 30 days (`REFRESH_TOKEN_LONG_EXPIRY`, fallback `30d`) with sliding extension up to a 90 day absolute cap (`REFRESH_TOKEN_LONG_CAP`, fallback `90d`).
- Rotated on every call to `POST /users/refresh-token` (old token revoked, new row created).
- Stored as HttpOnly cookie `refreshToken` and persisted server-side in `RefreshToken` collection with metadata: `initialIssuedAt`, `rotatedFrom`, `revoked`, `revokedAt`, `rememberMe`, `userAgent`, `ip`.

Remember Me:

- Backend sets `rememberMe` cookie (`true` / `false`) aligned to refresh window.
- Stealth mode access is permitted only when both `stealthMode` and `rememberMe` cookies are `true`.

Sliding Window Logic:

- For long sessions, each valid refresh attempts to extend `expiresAt` by the long duration, capped at `initialIssuedAt + LONG_REFRESH_CAP_MS`.
- Short sessions do not slide; they expire after the fixed window.

Reuse / Revocation Handling:

- Previous refresh token is flagged `revoked` when rotated.
- (Planned) Optional detection of reuse: if a revoked token is presented again, the chain can be invalidated (add logic to revoke descendants or blacklist access token).

Frontend Passive Refresh:

- Frontend schedules a silent refresh ~60s before access expiry (or at 90% of remaining time if short) using a custom hook.
- Visibility change triggers an early refresh if <30s remain.

Environment Variables (new / updated):

- `ACCESS_TOKEN_EXPIRY` e.g. `15m` (supports m/h/d)
- `REFRESH_TOKEN_SHORT_EXPIRY` e.g. `2h`
- `REFRESH_TOKEN_LONG_EXPIRY` e.g. `30d`
- `REFRESH_TOKEN_LONG_CAP` e.g. `90d`

Security Notes:

- HttpOnly + Secure cookies mitigate XSS token theft.
- Short access lifetime reduces exposure window.
- Rotation limits replay usefulness of stolen refresh tokens.
- Consider adding an IP / UA anomaly check and pruning job to remove expired rows periodically.

Operational Tasks (Recommended):

1. Add a cron / job to delete expired `RefreshToken` records (`expiresAt < now AND revoked=true`).
2. Monitor refresh volume; unusual spikes may indicate token reuse attempts.
3. Implement optional reuse detection (middleware checks if presented token is already revoked and originated rotation chain) and perform user logout.
