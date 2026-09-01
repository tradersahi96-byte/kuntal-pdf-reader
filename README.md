# Kuntal Documents 3.0

A Kuntal-branded document scanner/PDF utility app inspired by modern scanner apps.

## Included
- Modern scanner-style home screen with animated Quick Tools cards
- Auto Scan and Manual Scan camera flows
- Multi-page scan session
- Gallery/images to PDF
- Open local PDF files
- Native PDF reader
- Share PDF
- Recent documents stored locally
- Dark/light appearance setting
- Scanner-style UI without copying proprietary code/assets

## Build

```bash
npm install --legacy-peer-deps
npx expo prebuild
npx expo-doctor
npx eas build --platform android --profile preview
```

GitHub Actions uses the `EXPO_TOKEN` repository secret and the existing EAS project ID.
