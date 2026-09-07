# Studio Management System — Angular 22 + Capacitor + Tauri

Production-grade studio management system. Built with standalone Angular 22 components, Capacitor for mobile (iOS/Android), and Tauri for desktop (Mac/Windows/Linux).

## Platforms

- **Web**: Angular SPA
- **iOS / Android**: Capacitor 8
- **Mac / Windows / Linux**: Tauri 2

## Prerequisites

- Node.js >= 18
- npm
- Angular CLI: `npm install -g @angular/cli`

### Mobile (iOS/Android)
- iOS: Xcode + CocoaPods
- Android: Android Studio + JDK 17

### Desktop (Mac/Windows/Linux)
- Rust toolchain: https://www.rust-lang.org/tools/install
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: Visual Studio C++ Build Tools + WebView2
- Linux: `webkit2gtk`, `libssl-dev`, `libayatana-appindicator3-dev`

## Quick Start

```bash
npm install
```

## Build Commands

### Web
```bash
npm run build:prod          # production build → dist/studio-management-system/browser
npm start                   # dev server → http://localhost:4200
```

### iOS
```bash
npm run setup:ios           # first time only: npx cap add ios
npm run ios                 # build + sync + open Xcode
npm run ios:sim             # build + sync + run in simulator
npm run ios:build           # production archive
```

### Android
```bash
npm run setup:android       # first time only: npx cap add android
npm run android             # build + sync + open Android Studio
npm run android:build       # debug APK
npm run android:prod        # release APK/AAB
```

### Desktop (Tauri)
```bash
npm run desktop             # dev mode (requires Rust)
npm run desktop:build       # production build for current platform
npm run desktop:mac         # production build for macOS (Apple Silicon)
npm run desktop:win         # production build for Windows
```

### All Platforms
```bash
npm run all                 # build + sync all Capacitor platforms
```

## Scripts Reference

| Command | Platform | Description |
|---------|----------|-------------|
| `npm start` | Web | Dev server |
| `npm run build:prod` | Web | Production build |
| `npm run ios` | iOS | Build, sync, open Xcode |
| `npm run ios:sim` | iOS | Build, sync, run simulator |
| `npm run android` | Android | Build, sync, open Android Studio |
| `npm run desktop` | Desktop | Tauri dev mode |
| `npm run desktop:build` | Desktop | Tauri production build |
| `npm run sync` | Mobile | Sync web assets to mobile projects |

## Backend

Backend runs separately on port 3000. See `BE/` directory.

```bash
cd BE
npm install
npm run dev
```

## Notes

- Capacitor `webDir` points to `dist/studio-management-system/browser`
- Tauri `frontendDist` points to `../dist/studio-management-system/browser`
- Both use the same Angular production build output
