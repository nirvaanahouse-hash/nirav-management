# AGENTS.md

## Project Structure
- **Frontend (Angular 22)**: `studio-management/`
- **Backend (Node/Express)**: `BE/`

## Build Commands

### Frontend
```bash
# from studio-management/
export PATH="/usr/local/bin:$PATH"
node /usr/local/bin/npx ng build      # production build
node /usr/local/bin/npx ng serve --port 4200  # dev server
```

### Backend
```bash
# from BE/
node server.js    # start server (port 3000)
npm run dev       # start with nodemon
```

### Lint & Typecheck
```bash
# Frontend (from studio-management/)
export PATH="/usr/local/bin:$PATH"
node /usr/local/bin/npx ng build      # also validates TypeScript
```

The backend is plain CommonJS JavaScript — no TypeScript or Prisma.

## Ports
- Frontend: 4200
- Backend API: 3000

## IP & Security (SA-only, `/api/ip/*`, UI at `/sa/ip`)
- **IP guard** (`middleware/ipGuard.middleware.js`) — allow/block rules in `IpRule`.
  Off until `IpSetting.guardEnabled` is turned on from the UI; loopback is always allowed.
- **Rate limiting** (`middleware/rateLimit.middleware.js`) — hand-rolled in-memory per-IP,
  stricter on `/api/auth`. Limits live in the `IpSetting` singleton (`models/ipSetting.model.js`).
- **Login tracking** — `auth.controller.js` writes a `LoginEvent` per attempt (success + failures).
- **Request audit** (`middleware/requestLog.middleware.js`) — a `RequestLog` per authed API call,
  TTL-expired after `REQUEST_LOG_TTL_DAYS` (default 30).
- Optional env: `TRUST_PROXY`, `REQUEST_LOG_TTL_DAYS` (see `.env`).
