# Studio Management System — frontend

Angular 22 (standalone + signals) single codebase that ships to **web**, **desktop**
(Tauri) and **mobile** (Capacitor). The API lives in `../BE` and must be running for the
app to do anything (`env.ts` → `apiUrl`).

```
studio-management/
├── src/                Angular app
├── src-tauri/          Tauri (desktop) project — Rust + tauri.conf.json + icons
├── capacitor.config.ts Capacitor (mobile) config
├── dist/…/browser      Angular production output (used by Tauri & Capacitor)
└── package.json        scripts below
```

---

## Prerequisites

| For | Install |
|---|---|
| Everything | Node 20+ and npm, then `npm install` in this folder |
| Desktop (Tauri) | **Rust** — `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \| sh` (or `brew install rustup && rustup default stable`) |
| Desktop → macOS | Xcode Command Line Tools (`xcode-select --install`). For a **universal** build also `rustup target add x86_64-apple-darwin` |
| Desktop → Windows | Visual Studio C++ Build Tools + WebView2 (preinstalled on Win 11). Must be built **on Windows** — no cross-compile from macOS/Linux |
| Mobile → iOS | macOS + Xcode + CocoaPods |
| Mobile → Android | Android Studio + JDK 17 |

---

## Web

| Command | What it does |
|---|---|
| `npm start` | Dev server → http://localhost:4200 |
| `npm run build` | Production build → `dist/studio-management-system/browser/` |
| `npm run build:dev` | Unminified build (source maps) |
| `npm run watch` | Rebuild on change (dev config) |

Deploy = serve the contents of `dist/studio-management-system/browser/` as static files.

---

## Desktop (Tauri)

Needs Rust (see prerequisites). Each command runs the Angular production build first
(`beforeBuildCommand` in `src-tauri/tauri.conf.json`).

| Command | Platform | Output |
|---|---|---|
| `npm run desktop:dev` | current OS | Live desktop window with hot reload |
| `npm run desktop:mac` | macOS (Intel + Apple Silicon) | `src-tauri/target/universal-apple-darwin/release/bundle/dmg/*.dmg` + `.app` |
| `npm run desktop:windows` | Windows | `src-tauri/target/release/bundle/msi/*.msi` and `bundle/nsis/*-setup.exe` |

**Unsigned builds** (no Apple Developer ID / Windows cert):
- macOS 15+: drag the app to `/Applications`, then
  `xattr -dr com.apple.quarantine "/Applications/Studio Management System.app"` —
  or System Settings → Privacy & Security → **Open Anyway**.
- Windows: SmartScreen → **More info → Run anyway**.

The desktop app is just the Angular UI in a WebView — it still calls the API at
`src/app/env/env.ts` → `apiUrl`, so `../BE` + MongoDB must be reachable.

### Build both platforms without a Windows machine — GitHub Actions

`.github/workflows/desktop-build.yml` (repo root) builds the macOS universal `.dmg` **and**
the Windows `.msi`/`.exe` on GitHub's runners. From the **repo root**:

```bash
npm run repo:connect -- https://github.com/<you>/<repo>.git   # once
npm run repo:first-push                                        # push + trigger the first build
npm run desktop:build                                          # every later build
```

Download the installers from the workflow run's **Artifacts** (or the draft **Release** on a `v*` tag).

---

## Mobile (Capacitor)

First time only, add the native project(s):

```bash
npm run ios:add        # creates ios/
npm run android:add    # creates android/
```

Then (each command runs `npm run build && cap sync` first):

| Command | Platform | What it does |
|---|---|---|
| `npm run mobile:sync` | both | Build web + copy into the native projects |
| `npm run ios:open` | iOS | Open the project in **Xcode** (archive / run from there) |
| `npm run ios:run` | iOS | Build + run on a connected device / simulator |
| `npm run android:open` | Android | Open the project in **Android Studio** (build APK/AAB from there) |
| `npm run android:run` | Android | Build + run on a connected device / emulator |

Bundle id / app name: `capacitor.config.ts` (`appId`, `appName`).

---

## Testing

Vitest via the Angular `@angular/build:unit-test` builder (`src/**/*.spec.ts`).

| Command | What it does |
|---|---|
| `npm test` | Run all unit tests once |
| `npm run test:watch` | Re-run on change |
| `npm run test:coverage` | Run with a coverage report |

---

## Backend

Runs separately on port 3000:

```bash
cd ../BE
npm install
npm run dev
```

---

## Where the config lives

| Setting | File |
|---|---|
| API URL | `src/app/env/env.ts` → `apiUrl` |
| Web build options | `angular.json` → `projects…architect.build` |
| Desktop window / bundle / **identifier** / version | `src-tauri/tauri.conf.json` |
| Desktop icons | `src-tauri/icons/` — regenerate all with `npx tauri icon path/to/1024.png` |
| Mobile **appId / appName** | `capacitor.config.ts` |
# niravana-house
