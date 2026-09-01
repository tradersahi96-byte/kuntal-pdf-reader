# Kuntal Documents V9.2.3

Expo SDK 53 Android PDF/scanner project prepared for EAS APK builds.

## Build

GitHub Actions uses Node 20, installs dependencies with `npm install --legacy-peer-deps`, verifies the Expo config, authenticates with `EXPO_TOKEN`, and starts an EAS Android APK build.

## Important

The previous `@infinitered/react-native-mlkit-text-recognition@4.0.0` dependency was removed because that exact package version is not currently available from npm. This prevents the `npm ERR! notarget` failure seen in GitHub Actions. OCR remains visible in the UI but shows a clear unavailable message in this build.
