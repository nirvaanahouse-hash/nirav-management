# AGENTS.md

## Project Structure
- **Frontend (Angular 22)**: `studio-management/`
- **Backend (Node/Express)**: `BE/`

## Build Commands

### Frontend (`studio-management/`) — see its README.md for the full list
```bash
npm start            # dev server → http://localhost:4200
npm run build        # production build (also validates TypeScript) → dist/studio-management-system/browser
npm test             # unit tests (Vitest via @angular/build:unit-test)
npm run desktop:mac  # Tauri universal .dmg  (needs Rust)
npm run desktop:windows   # Tauri .msi/.exe (must run on Windows)
npm run ios:open / android:open   # Capacitor → open Xcode / Android Studio
```
Node/npx live at `/opt/homebrew/bin`. Rust (for Tauri) is at `/opt/homebrew/opt/rustup/bin`.

### Backend
```bash
# from BE/
node server.js    # start server (port 3000)
npm run dev       # start with nodemon
```

The backend is plain CommonJS JavaScript — no TypeScript or Prisma.

## Ports
- Frontend: 4200
- Backend API: 3000

## Desktop app (Tauri v2)
- Project lives in `studio-management/src-tauri/`. `tauri.conf.json` `beforeBuildCommand`
  runs `npm run build:prod`; `frontendDist` = `../dist/studio-management-system/browser`.
- Local build (needs Rust): from `studio-management/` → `npm run desktop` (dev),
  `npm run desktop:mac` (universal `.dmg`), `npm run desktop:win` (on Windows).
- CI: `.github/workflows/desktop-build.yml` builds the universal macOS `.dmg` and the
  Windows `.msi` / NSIS `-setup.exe` via `tauri-apps/tauri-action`. Run it from the
  Actions tab, or push a `v*` tag to also publish a draft GitHub Release. Installers are
  attached to the run as artifacts (`desktop-macos-latest`, `desktop-windows-latest`).
- The desktop app is only the Angular UI in a WebView — it still calls the API at
  `env.ts` `apiUrl`, so the `BE/` server + MongoDB must be reachable from the machine
  running it. Builds are unsigned (no Apple Developer ID / Windows cert).

## IP & Security (SA-only, `/api/ip/*`, UI at `/sa/ip`)
- **IP guard** (`middleware/ipGuard.middleware.js`) — allow/block rules in `IpRule`.
  Off until `IpSetting.guardEnabled` is turned on from the UI; loopback is always allowed.
- **Rate limiting** (`middleware/rateLimit.middleware.js`) — hand-rolled in-memory per-IP,
  stricter on `/api/auth`. Limits live in the `IpSetting` singleton (`models/ipSetting.model.js`).
- **Login tracking** — `auth.controller.js` writes a `LoginEvent` per attempt (success + failures).
- **Request audit** (`middleware/requestLog.middleware.js`) — a `RequestLog` per authed API call,
  TTL-expired after `REQUEST_LOG_TTL_DAYS` (default 30).
- Optional env: `TRUST_PROXY`, `REQUEST_LOG_TTL_DAYS` (see `.env`).

## Ticket types (SA-managed, `/api/ticket-type`, UI at `/sa/ticket-types`)
- Types live in the `TicketType` collection (`models/ticketType.model.js`), not in
  `constants/index.js`. The old `TICKET_TYPES` constant now only seeds that collection on
  first boot (`utils/seed-ticket-types.js`) and acts as a display fallback.
- `key` (e.g. `weddingJob`) is what each ticket stores and never changes; the label,
  badge variant and active flag can be edited. Hour-wise ("JOB") types always end in
  `Job` — the whole codebase detects hour-wise pricing from that suffix — so `isJob` is
  fixed when a type is created.
- A type that tickets already reference cannot be deleted (409); switch it off instead and
  it drops out of the ticket form while old tickets still render their label.
- `utils/ticket-types.js` caches the registry in-process (60 s TTL, invalidated on write).
  `middleware/ticketType.middleware.js` loads it onto the request so the sync ticket
  validators can check `ticketType` against the live list.
- Frontend: `TicketMetaService` (`GET /api/ticket/form-meta`) is the single source for
  type options, labels and badge variants; `TicketTypeService` is the SA CRUD client.
- Permission: `tickets.types.manage` (SA bypasses all permission checks).
