# Kuntal Documents V9.2.1

Premium Expo SDK 53 Android PDF + Smart Scanner workspace.

## Included
- Native PDF viewer with page count, smooth zoom/pan and page navigation
- Open/share PDF
- Smart Scan camera flow with Auto and Manual modes
- Multi-page document capture, reorder, delete and add page
- Gallery → PDF
- Document, B&W, Grayscale and Clean image presets
- Merge PDFs
- Extract current page as a new PDF
- Rotate current PDF page
- OCR using native ML Kit
- Watermark and signature text layers for generated PDFs
- PDF quick-edit overlay panel (text/signature/watermark)
- PDF information panel and bookmark UI
- Premium home dashboard and Quick Tools search
- App icon configured at root as `icon.png` (1024×1024)

## V9.2.1 build-stability changes
- Expo SDK 53-compatible dependency versions are pinned instead of using loose ranges for native-critical packages.
- New Architecture is explicitly disabled for better compatibility with the native PDF/ML Kit stack used by this project.
- Explicit `babel.config.js` and Expo `metro.config.js` are included.
- Root `icon.png` is retained and referenced by `app.json`; no `assets/` folder is required for the icon.

## V9.2.2 — GitHub Actions / EAS build fixes
These fixes address real build failures encountered when building via GitHub Actions + EAS:

1. **Missing `babel-preset-expo` / `@babel/core`** — these were used by `babel.config.js` but never listed in `devDependencies`, which breaks Metro bundling. Added both.
2. **`react-native-blob-util` was pinned to `0.21.2`**, which predates official React Native 0.76+ compatibility. This project uses RN 0.79.5. Bumped to `^0.24.10`.
3. **`eas.json` was missing `cli.appVersionSource`.** Modern EAS CLI requires this to be set explicitly for non-interactive builds (CI), otherwise it can prompt or fail. Set to `"local"`, and `android.versionCode` is now explicit in `app.json`.
4. **`package-lock.json` is intentionally NOT committed** in this delivery — it could not be generated in this environment without network access to npm, and a hand-written lockfile with fake integrity hashes would be actively unsafe. The workflow uses `npm install` (not `npm ci`), so it works without one. **Recommended one-time step:** run `npm install` locally once and commit the generated `package-lock.json` — this makes builds faster and fully reproducible, and lets you add `cache: npm` to the GitHub Actions `setup-node` step.
5. Added `.npmrc` with `legacy-peer-deps=true` and added `--legacy-peer-deps` to the CI install step, to avoid `ERESOLVE` peer-dependency errors that are common with React 19 + native libraries that haven't updated their `peerDependencies` metadata yet.
6. Added an `eas whoami` step in the workflow right after installing the EAS CLI, so an invalid/missing `EXPO_TOKEN` fails fast with a clear message instead of a deep, cryptic error inside `eas build`.

### Dependency versions verified against upstream sources for Expo SDK 53
- `react-native-pdf@6.7.7` + `@config-plugins/react-native-pdf@11.0.0` + `@config-plugins/react-native-blob-util@11.0.0` — this exact version triplet is the one published by `expo/config-plugins` for SDK 53.
- `@infinitered/react-native-mlkit-text-recognition@4.0.0` — its changelog explicitly states "Added module support for Expo SDK 53."

### App.js bug fixes carried over
- Signature/Watermark tools no longer rely on `Alert.prompt` (an iOS-only API that silently did nothing on Android). They now open the existing PDF Quick Edit modal instead.
- Fixed a double-rotation bug: page rotation is now only baked into the PDF via `pdf-lib`; the redundant view-level CSS transform (which caused rotated pages to render clipped/incorrect) was removed.
- Added a busy/loading overlay for PDF create, merge, split, rotate, gallery import and OCR.
- Added error handling around `openPDF` for cancelled/failed picks.

## Build

### Locally
```bash
npm install --legacy-peer-deps
npx eas login
npx eas build -p android --profile preview
```

### Via GitHub Actions
1. Push this project to a GitHub repository.
2. In the repo, go to Settings → Secrets and variables → Actions, and add a secret named `EXPO_TOKEN` with a valid Expo access token (create one at https://expo.dev/accounts/[your-account]/settings/access-tokens).
3. Run the "Build Kuntal Documents APK" workflow from the Actions tab (or push to `main`).
4. The workflow builds on EAS's servers using the `preview` profile, which is configured for `distribution: internal` + `buildType: apk`, so it produces a directly installable `.apk`, not a Play Store `.aab`.
5. Download the APK from the build details page on https://expo.dev once the job finishes (the GitHub Actions log will print a link).

**Important:** `app.json`'s `extra.eas.projectId` and `owner` fields are tied to a specific Expo account/project. If you don't have access to that project, either request access or run `npx eas init` once locally (interactively) to link the project to your own Expo account, then commit the updated `app.json`.

## Build fix

OCR uses `@infinitered/react-native-mlkit-text-recognition` 4.0.0, which is the Expo SDK 53-compatible MLKit text-recognition line. Do not change this package to `@react-native-ml-kit/text-recognition`; that is a different, unrelated package with a different API.
